import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  AnimalCategory,
  deriveAnimalCategory,
} from 'src/modules/cattle/domain/animal-category';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';
import { MilkService } from 'src/modules/milk/application/services/milk.service';
import {
  AnimalType,
  computeRequirements,
  Requirements,
  RequirementsInput,
} from '../../domain/requirements';
import { FeedRequirementsQueryDto } from '../../presentation/dto/feed-requirements-query.dto';
import { RequirementSettingsService } from './requirement-settings.service';
import { FeedPlanResolverService } from './feed-plan-resolver.service';
import { bandsFromSettings } from '../../domain/program-fit';
import { DEFAULT_REQUIREMENT_SETTINGS } from '../../domain/requirement-settings';

const MS_PER_DAY = 86_400_000;

/** Nutritional-requirements calculator (PRD §12.4, RAKHAL-081). Thin wrapper over the pure domain,
 * plus (2026-07-17, user request) two cow-driven modes that auto-derive `weightKg`/`milkTargetL`/
 * `gestationDays`/`bcs` from real cattle/reproduction/milk records instead of manual entry:
 * `cattleId` (single cow). Falls back to the manual
 * `weightKg`/`milkTargetL` query fields when a cow's records are incomplete, so this never silently
 * fabricates a number — every derived input is flagged in the response's `data_source` block. */
@Injectable()
export class FeedRequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly milk: MilkService,
    private readonly requirementSettings: RequirementSettingsService,
    private readonly programs: FeedPlanResolverService,
  ) {}

  async calc(farmId: string, query: FeedRequirementsQueryDto) {
    if (query.cattleId)
      return this.calcForCattle(farmId, query.cattleId, query);
    return this.calcManual(query, farmId);
  }

  private async calcManual(query: FeedRequirementsQueryDto, farmId: string) {
    const settings = await this.requirementSettings.resolve(farmId);
    const req = computeRequirements(
      {
        weightKg: query.weightKg as number,
        milkTargetL: query.milkTargetL as number,
        milkFatPct: query.milkFatPct,
        milkProteinPct: query.milkProteinPct,
        gestationDays: query.gestationDays,
        bcs: query.bcs,
        dim: query.dim,
        animalType: query.animalType,
      },
      settings,
    );
    return {
      inputs: {
        weight_kg: query.weightKg as number,
        milk_target_l: query.milkTargetL as number,
        milk_fat_pct: query.milkFatPct ?? 4.0,
        milk_protein_pct: query.milkProteinPct,
        gestation_days: query.gestationDays,
        bcs: query.bcs,
        dim: query.dim,
        animal_type: query.animalType ?? 'COW',
      },
      data_source: { weight: 'manual', milk_yield: 'manual' },
      requirements: this.reqShape(req),
    };
  }

  /** RAKHAL-453/RD-108: HEIFER comes from the derived `AnimalCategory` (female, no calvings) — the
   * old `productionStatus === 'GROWING'` check never fired after RAKHAL-269 removed that status, so
   * every non-dry animal was treated as a lactating cow. DRY still comes from `productionStatus`. */
  private inferAnimalType(
    productionStatus: string | null | undefined,
    category: AnimalCategory,
  ): AnimalType {
    if (category === 'HEIFER') return 'HEIFER';
    if (productionStatus === 'DRY') return 'DRY';
    return 'COW';
  }

  /** RAKHAL-453: days in milk, derived from records instead of only trusting `query.dim`. Active
   * lactation first (a farmer-supplied estimate wins for a purchased-lactating intake, which has no
   * calving to count from), then the reproduction profile's last calving date. `null` = unknown,
   * so the engine falls back to its settings default. */
  private deriveDim(
    lactation:
      | {
          startDate: Date;
          isEstimated: boolean;
          estimatedDaysInMilk: number | null;
        }
      | undefined,
    lastCalvingDate: Date | null | undefined,
    now: Date,
  ): number | null {
    const daysSince = (d: Date) =>
      Math.max(0, Math.floor((now.getTime() - d.getTime()) / MS_PER_DAY));
    if (lactation) {
      if (lactation.isEstimated && lactation.estimatedDaysInMilk != null)
        return lactation.estimatedDaysInMilk;
      return daysSince(lactation.startDate);
    }
    return lastCalvingDate ? daysSince(lastCalvingDate) : null;
  }

  /** Single cow, auto-derived from `Cattle.lastWeightKg`/`lastBcs`, the active `Pregnancy` (if any,
   * via `ReproductionProfile.currentPregnancyId`), and `MilkService.averageDailyYield` (7-day
   * trailing average). Falls back to the manual `weightKg`/`milkTargetL` query fields when a
   * record is missing. */
  private async calcForCattle(
    farmId: string,
    cattleId: string,
    query: FeedRequirementsQueryDto,
  ) {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id: cattleId, ...activeHerd(farmId) },
      select: {
        id: true,
        lastWeightKg: true,
        lastBcs: true,
        productionStatus: true,
        gender: true,
        dateOfBirth: true,
        reproductionProfile: {
          select: { totalCalvings: true, lastCalvingDate: true },
        },
        lactations: {
          where: { status: 'ACTIVE' },
          orderBy: { startDate: 'desc' },
          take: 1,
          select: {
            startDate: true,
            isEstimated: true,
            estimatedDaysInMilk: true,
          },
        },
      },
    });
    if (!cattle) throw new NotFoundException('Cattle not found');
    const now = new Date();
    const category = deriveAnimalCategory({
      gender: cattle.gender,
      dateOfBirth: cattle.dateOfBirth,
      totalCalvings: cattle.reproductionProfile?.totalCalvings ?? 0,
      now,
    });
    const animalType =
      query.animalType ??
      this.inferAnimalType(cattle.productionStatus, category);
    const derivedDim = this.deriveDim(
      cattle.lactations[0],
      cattle.reproductionProfile?.lastCalvingDate,
      now,
    );
    const dim = query.dim ?? derivedDim ?? undefined;

    const [gestationDays, avgYield] = await Promise.all([
      this.currentGestationDays(cattleId),
      this.milk.averageDailyYield(farmId, [cattleId]),
    ]);

    const weightSource =
      cattle.lastWeightKg != null ? 'cattle_record' : 'manual';
    const weightKg = cattle.lastWeightKg ?? query.weightKg;
    if (weightKg == null) {
      throw new BadRequestException(
        'Cattle has no recorded weight — supply weightKg manually',
      );
    }

    const milkFromRecords = avgYield.get(cattleId);
    const milkSource =
      milkFromRecords != null
        ? 'milk_log_7d_avg'
        : query.milkTargetL != null
          ? 'manual'
          : 'assumed_zero';
    const milkTargetL = milkFromRecords ?? query.milkTargetL ?? 0;

    const input: RequirementsInput = {
      weightKg,
      milkTargetL,
      milkFatPct: query.milkFatPct,
      milkProteinPct: query.milkProteinPct,
      gestationDays: query.gestationDays ?? gestationDays ?? undefined,
      bcs: query.bcs ?? cattle.lastBcs ?? undefined,
      dim,
      animalType,
    };
    const settings = await this.requirementSettings.resolve(farmId);
    const req = computeRequirements(input, settings);

    return {
      inputs: {
        weight_kg: weightKg,
        milk_target_l: milkTargetL,
        milk_fat_pct: query.milkFatPct ?? 4.0,
        gestation_days: input.gestationDays,
        bcs: input.bcs,
        dim,
        animal_type: animalType,
      },
      data_source: {
        weight: weightSource,
        milk_yield: milkSource,
        dim:
          query.dim != null
            ? 'manual'
            : derivedDim != null
              ? 'derived_from_records'
              : 'settings_default',
      },
      requirements: this.reqShape(req),
    };
  }

  /**
   * What the whole active herd needs today, from live cattle records (RAKHAL-412).
   *
   * Averages weight/milk/BCS across every active cow. Returns `null` for a farm with no
   * cattle — the caller reports that rather than inventing a number.
   */
  private async herdRequirementBlock(farmId: string) {
    const cattle = await this.prisma.cattle.findMany({
      where: activeHerd(farmId),
      select: { id: true, lastWeightKg: true, lastBcs: true },
    });
    if (cattle.length === 0) return null;

    const weights = cattle
      .map((c) => c.lastWeightKg)
      .filter((w): w is number => w != null);
    if (weights.length === 0) return null;

    const avgYields = await this.milk.averageDailyYield(
      farmId,
      cattle.map((c) => c.id),
    );
    const yields = cattle
      .map((c) => avgYields.get(c.id))
      .filter((y): y is number => y != null);
    const bcsValues = cattle
      .map((c) => c.lastBcs)
      .filter((b): b is number => b != null);

    const weightKg = avg(weights) as number;
    const milkTargetL = avg(yields) ?? 0;
    const bcs = avg(bcsValues);
    const settings = await this.requirementSettings.resolve(farmId);
    const req = computeRequirements(
      { weightKg, milkTargetL, bcs: bcs ?? undefined },
      settings,
    );

    return {
      headcount: cattle.length,
      inputs: {
        weight_kg: round2(weightKg),
        milk_target_l: round2(milkTargetL),
        bcs: bcs != null ? round2(bcs) : null,
        cattle_with_weight: weights.length,
        cattle_with_milk_data: yields.length,
      },
      data_source: {
        weight: 'cattle_record_avg',
        milk_yield: yields.length > 0 ? 'milk_log_7d_avg' : 'assumed_zero',
      },
      per_cow: this.reqShape(req),
      herd_total: this.reqShape(scaleRequirements(req, cattle.length)),
    };
  }

  /**
   * Farm-wide "Today's Feed Requirement" rollup (2026-08-13, user request — doc's §5/§12
   * mockup: "Corn silage 300kg, Grass 180kg..."). Every active `FEED_MIXTURE` concentration's
   * per-cow-per-day ingredient lines, multiplied by that ration's resolved headcount
   * (INDIVIDUAL = 1, HERD = whole active herd), aggregated by ingredient across every ration
   * on the farm. Read-only aggregation, no persisted state.
   */
  async getTodaysRequirement(farmId: string) {
    const [requirement, cows] = await Promise.all([
      this.herdRequirementBlock(farmId),
      this.prisma.cattle.findMany({
        where: activeHerd(farmId),
        select: { id: true },
      }),
    ]);

    // MILESTONE 27 (RAKHAL-458): what the herd eats today is the feeding **programs** actually applied —
    // each plan's lines x the number of cows resolved onto it (individual -> group -> herd). Before this it
    // was every live TMR x its targeting, which made a recipe live the moment it was created.
    const programs = await this.programs.resolveForCattle(
      farmId,
      cows.map((c) => c.id),
    );

    // RAKHAL-412: what the animals need is computed from live cattle records and is returned whether
    // or not a program exists — it depends only on having cows.
    if (programs.size === 0) {
      return {
        by_ingredient: [],
        by_ration: [],
        grand_total_kg: 0,
        requirement,
        has_active_ration: false,
      };
    }

    type Program = ReturnType<typeof programs.get> & object;
    const byPlan = new Map<string, { program: Program; heads: number }>();
    for (const p of programs.values()) {
      const e = byPlan.get(p.planId) ?? { program: p, heads: 0 };
      e.heads += 1;
      byPlan.set(p.planId, e);
    }

    const allLines = [...byPlan.values()].flatMap((e) => e.program.lines);
    const itemIds = [
      ...new Set(
        allLines.map((l) => l.feedItemId).filter((x): x is string => !!x),
      ),
    ];
    const recipeIds = [
      ...new Set(
        allLines.map((l) => l.concentrationId).filter((x): x is string => !!x),
      ),
    ];
    const [items, recipes] = await Promise.all([
      this.prisma.feedItem.findMany({
        where: { farmId, id: { in: itemIds } },
        select: { id: true, name: true },
      }),
      this.prisma.feedConcentration.findMany({
        where: { farmId, id: { in: recipeIds } },
        select: { id: true, name: true },
      }),
    ]);
    const nameByKey = new Map<string, string>([
      ...items.map((i): [string, string] => [i.id, i.name]),
      ...recipes.map((r): [string, string] => [r.id, r.name]),
    ]);

    const totalsByKey = new Map<string, number>();
    const byRation: {
      plan_id: string;
      concentration_id: string | null;
      name: string;
      headcount: number;
      total_kg: number;
    }[] = [];
    for (const { program, heads } of byPlan.values()) {
      let planTotalKg = 0;
      for (const line of program.lines) {
        const kg = round2(line.kgPerDay * heads);
        planTotalKg += kg;
        const key = (line.feedItemId ?? line.concentrationId) as string;
        totalsByKey.set(key, round2((totalsByKey.get(key) ?? 0) + kg));
      }
      const only =
        program.lines.length === 1 ? program.lines[0].concentrationId : null;
      byRation.push({
        plan_id: program.planId,
        // Kept for API compatibility: the recipe id when the program is exactly one TMR/concentrate line.
        concentration_id: only,
        name: program.planName,
        headcount: heads,
        total_kg: round2(planTotalKg),
      });
    }

    const byIngredient = [...totalsByKey.entries()]
      .map(([key, totalKg]) => ({
        ingredient_id: key,
        name: nameByKey.get(key) ?? key,
        total_kg: round2(totalKg),
      }))
      .sort((x, y) => y.total_kg - x.total_kg);

    return {
      by_ingredient: byIngredient,
      by_ration: byRation,
      grand_total_kg: round2(
        byIngredient.reduce((sum, i) => sum + i.total_kg, 0),
      ),
      requirement,
      has_active_ration: true,
    };
  }

  /** Live gestation day count from the cow's active pregnancy (`ReproductionProfile.currentPregnancyId`
   * → `Pregnancy.conceptionDate`), not the stored `Pregnancy.gestationDays` snapshot (which is only
   * set at diagnosis time and would go stale). `null` when the cow has no active pregnancy. */
  /**
   * Requirements for a batch of saved rations, in a constant number of queries (RAKHAL-411).
   *
   * `FeedConcentrationService.enrich()` runs once per row on the list path, so resolving each
   * ration's cow individually would be O(N) round-trips. This gathers every cow the batch refers
   * to (directly, for an INDIVIDUAL ration) and derives them all together: one cattle query, one reproduction-profile query, one pregnancy query, one
   * batched milk average, one settings resolve. Adding rations does not add queries.
   *
   * Returns the raw domain object rather than the snake_case API shape, because the caller needs
   * it to score a formula. `null` where nothing can be computed: a Concentrate Mixer carries no
   * target at all, and a cow with no recorded weight has nothing to work from.
   *
   * The derivation deliberately mirrors `calcForCattle` field for field, so a
   * saved ration and `GET /feed/requirements` for the same animal agree. That parity is asserted
   * in `feed-requirements-parity.e2e-spec.ts`.
   */
  async resolveForConcentrations(
    farmId: string,
    rows: {
      id: string;
      kind: string;
      targetType: string | null;
      cattleId: string | null;
      targetWeightKg: number | null;
      targetMilkL: number | null;
    }[],
  ): Promise<Map<string, Requirements | null>> {
    const out = new Map<string, Requirements | null>();
    if (rows.length === 0) return out;

    const settings = await this.requirementSettings.resolve(farmId);

    // A Concentrate Mixer is a virtual recipe with no target — it has never carried a
    // requirement and still does not.
    const scorable = rows.filter((r) => r.kind !== 'CONCENTRATE_TEMPLATE');
    for (const r of rows) {
      if (r.kind === 'CONCENTRATE_TEMPLATE') out.set(r.id, null);
    }
    if (scorable.length === 0) return out;

    const directCattleIds = [
      ...new Set(
        scorable
          .filter((r) => r.targetType === 'INDIVIDUAL' && r.cattleId)
          .map((r) => r.cattleId as string),
      ),
    ];

    // Every individually-targeted cow the batch touches, in one query.
    const cattle =
      directCattleIds.length > 0
        ? await this.prisma.cattle.findMany({
            where: {
              ...activeHerd(farmId),
              id: { in: directCattleIds },
            },
            select: {
              id: true,
              lastWeightKg: true,
              lastBcs: true,
              productionStatus: true,
              gender: true,
              dateOfBirth: true,
              reproductionProfile: { select: { totalCalvings: true } },
            },
          })
        : [];

    const cattleById = new Map(cattle.map((c) => [c.id, c]));

    const allIds = cattle.map((c) => c.id);
    const [gestationByCow, yieldByCow] = await Promise.all([
      this.gestationDaysFor(allIds),
      allIds.length > 0
        ? this.milk.averageDailyYield(farmId, allIds)
        : Promise.resolve(new Map<string, number>()),
    ]);

    for (const row of scorable) {
      let req: Requirements | null = null;

      if (row.targetType === 'INDIVIDUAL' && row.cattleId) {
        const c = cattleById.get(row.cattleId);
        // Fall back to the ration's stored target when the cow is gone (sold, deleted) or has
        // no recorded weight — a saved ration must stay readable either way.
        const weightKg = c?.lastWeightKg ?? row.targetWeightKg;
        if (weightKg != null) {
          req = computeRequirements(
            {
              weightKg,
              milkTargetL:
                (c ? yieldByCow.get(c.id) : undefined) ?? row.targetMilkL ?? 0,
              gestationDays: c ? gestationByCow.get(c.id) : undefined,
              bcs: c?.lastBcs ?? undefined,
              animalType: c
                ? this.inferAnimalType(
                    c.productionStatus,
                    deriveAnimalCategory({
                      gender: c.gender,
                      dateOfBirth: c.dateOfBirth,
                      totalCalvings: c.reproductionProfile?.totalCalvings ?? 0,
                    }),
                  )
                : undefined,
            },
            settings,
          );
        }
      }

      // HERD-targeted rations, and any INDIVIDUAL one whose cow yielded nothing, fall back
      // to whatever target the ration itself stored — the pre-RAKHAL-411 behaviour.
      if (
        req == null &&
        row.targetWeightKg != null &&
        row.targetMilkL != null
      ) {
        req = computeRequirements(
          { weightKg: row.targetWeightKg, milkTargetL: row.targetMilkL },
          settings,
        );
      }

      out.set(row.id, req);
    }

    return out;
  }

  /**
   * RAKHAL-454 (MILESTONE 27): per-cow requirement for many cows in a fixed number of service-level
   * queries (cattle, latest weight dates, gestation ×2, milk average, settings), whatever the herd size.
   * Computed on read — always fresh, no cache. Every input that fell back to an assumption raises a
   * flag in `flags[]` so a caller can show "estimated" instead of a silent green.
   *
   * Flags: `weight_stale` (latest weigh-in older than 60 days), `weight_estimated` (no weight at all →
   * farm default), `bcs_default`, `milk_missing` (a milking cow with no milk records), `dim_default`
   * (a milking cow whose days-in-milk could not be derived).
   * Cows outside the active herd are returned in `missing_cattle_ids`.
   */
  async forCattle(farmId: string, cattleIds: string[], date?: string) {
    const asOf = date ? new Date(date) : new Date();
    const ids = [...new Set(cattleIds)];
    const empty = {
      date: asOf.toISOString().slice(0, 10),
      cows: [],
      missing_cattle_ids: [] as string[],
      bands: bandsFromSettings(DEFAULT_REQUIREMENT_SETTINGS),
    };
    if (ids.length === 0) return empty;

    const [cattle, weighIns, settings] = await Promise.all([
      this.prisma.cattle.findMany({
        where: { ...activeHerd(farmId), id: { in: ids } },
        select: {
          id: true,
          lastWeightKg: true,
          lastBcs: true,
          productionStatus: true,
          gender: true,
          dateOfBirth: true,
          reproductionProfile: {
            select: { totalCalvings: true, lastCalvingDate: true },
          },
          lactations: {
            where: { status: 'ACTIVE' },
            orderBy: { startDate: 'desc' },
            take: 1,
            select: {
              startDate: true,
              isEstimated: true,
              estimatedDaysInMilk: true,
            },
          },
        },
      }),
      this.prisma.weightRecord.findMany({
        where: { cattleId: { in: ids } },
        orderBy: { recordedDate: 'desc' },
        distinct: ['cattleId'],
        select: { cattleId: true, recordedDate: true },
      }),
      this.requirementSettings.resolve(farmId),
    ]);
    const foundIds = cattle.map((c) => c.id);
    const [gestationByCow, yieldByCow] = await Promise.all([
      this.gestationDaysFor(foundIds),
      foundIds.length > 0
        ? this.milk.averageDailyYield(farmId, foundIds, asOf)
        : Promise.resolve(new Map<string, number>()),
    ]);
    const weighInDate = new Map(
      weighIns.map((w) => [w.cattleId, w.recordedDate]),
    );

    const cows = cattle.map((c) => {
      const flags: string[] = [];
      const category = deriveAnimalCategory({
        gender: c.gender,
        dateOfBirth: c.dateOfBirth,
        totalCalvings: c.reproductionProfile?.totalCalvings ?? 0,
        now: asOf,
      });
      const animalType = this.inferAnimalType(c.productionStatus, category);
      const milking = animalType === 'COW';

      let weightKg = c.lastWeightKg;
      if (weightKg == null) {
        weightKg = settings.defaultWeightKg;
        flags.push('weight_estimated');
      } else {
        const weighed = weighInDate.get(c.id);
        if (weighed && (asOf.getTime() - weighed.getTime()) / MS_PER_DAY > 60) {
          flags.push('weight_stale');
        }
      }

      if (c.lastBcs == null) flags.push('bcs_default');

      const milkFromRecords = yieldByCow.get(c.id);
      if (milkFromRecords == null && milking) flags.push('milk_missing');

      const derivedDim = this.deriveDim(
        c.lactations[0],
        c.reproductionProfile?.lastCalvingDate,
        asOf,
      );
      if (derivedDim == null && milking) flags.push('dim_default');

      const input: RequirementsInput = {
        weightKg,
        milkTargetL: milkFromRecords ?? 0,
        gestationDays: gestationByCow.get(c.id),
        bcs: c.lastBcs ?? undefined,
        dim: derivedDim ?? undefined,
        animalType,
      };
      const req = computeRequirements(input, settings);
      return {
        cattle_id: c.id,
        inputs: {
          weight_kg: weightKg,
          milk_target_l: milkFromRecords ?? 0,
          gestation_days: input.gestationDays,
          bcs: input.bcs,
          dim: derivedDim ?? settings.defaultDaysInMilk,
          animal_type: animalType,
        },
        flags,
        requirements: this.reqShape(req),
      };
    });

    return {
      date: asOf.toISOString().slice(0, 10),
      cows,
      missing_cattle_ids: ids.filter((id) => !foundIds.includes(id)),
      /** The farm's alert tolerance bands (RAKHAL-458) — same settings resolve as the requirement itself. */
      bands: bandsFromSettings(settings),
    };
  }

  /** Live gestation days for many cows at once — the batched twin of `currentGestationDays`. */
  private async gestationDaysFor(
    cattleIds: string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (cattleIds.length === 0) return out;

    const profiles = await this.prisma.reproductionProfile.findMany({
      where: { cattleId: { in: cattleIds }, currentPregnancyId: { not: null } },
      select: { cattleId: true, currentPregnancyId: true },
    });
    if (profiles.length === 0) return out;

    const pregnancies = await this.prisma.pregnancy.findMany({
      where: {
        id: { in: profiles.map((p) => p.currentPregnancyId as string) },
        status: 'ACTIVE',
      },
      select: { id: true, conceptionDate: true },
    });
    const conceptionById = new Map(
      pregnancies.map((p) => [p.id, p.conceptionDate]),
    );

    for (const profile of profiles) {
      const conception = conceptionById.get(
        profile.currentPregnancyId as string,
      );
      if (!conception) continue;
      out.set(
        profile.cattleId,
        Math.max(
          0,
          Math.floor((Date.now() - conception.getTime()) / MS_PER_DAY),
        ),
      );
    }
    return out;
  }

  private async currentGestationDays(cattleId: string): Promise<number | null> {
    const profile = await this.prisma.reproductionProfile.findUnique({
      where: { cattleId },
      select: { currentPregnancyId: true },
    });
    if (!profile?.currentPregnancyId) return null;
    const pregnancy = await this.prisma.pregnancy.findFirst({
      where: { id: profile.currentPregnancyId, status: 'ACTIVE' },
      select: { conceptionDate: true },
    });
    if (!pregnancy) return null;
    return Math.max(
      0,
      Math.floor(
        (Date.now() - pregnancy.conceptionDate.getTime()) / MS_PER_DAY,
      ),
    );
  }

  private reqShape(req: Requirements) {
    return {
      dm_kg: req.dmKg,
      cp_kg: req.cpKg,
      me_mj: req.meMj,
      ndf_kg: req.ndfKg,
      fat_kg: req.fatKg,
      ne_mcal: req.neMcal,
      energy_density_mj_per_kg_dm: req.energyDensityMjPerKgDm,
      cp_pct_of_dm: req.cpPctOfDm,
      tdn_kg: req.tdnKg,
      calcium_kg: req.calciumKg,
      phosphorus_kg: req.phosphorusKg,
      adf_kg: req.adfKg,
      rdp_pct: req.rdpPct,
      rup_pct: req.rupPct,
      ndf_max_kg: req.ndfMaxKg,
      ca_p_ratio_target: req.caPRatioTarget,
      breakdown: {
        dm: req.breakdown.dm,
        me: req.breakdown.me,
        cp: req.breakdown.cp,
      },
    };
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Mean of the values present, or `null` when there are none — never a fabricated zero. */
const avg = (values: number[]): number | null =>
  values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

function scaleRequirements(req: Requirements, factor: number): Requirements {
  return {
    dmKg: round2(req.dmKg * factor),
    cpKg: round2(req.cpKg * factor),
    meMj: round2(req.meMj * factor),
    ndfKg: round2(req.ndfKg * factor),
    fatKg: round2(req.fatKg * factor),
    neMcal: round2(req.neMcal * factor),
    energyDensityMjPerKgDm: req.energyDensityMjPerKgDm,
    cpPctOfDm: req.cpPctOfDm,
    tdnKg: round2(req.tdnKg * factor),
    calciumKg: round2(req.calciumKg * factor),
    phosphorusKg: round2(req.phosphorusKg * factor),
    adfKg: round2(req.adfKg * factor),
    rdpPct: req.rdpPct,
    rupPct: req.rupPct,
    ndfMaxKg: round2(req.ndfMaxKg * factor),
    caPRatioTarget: req.caPRatioTarget,
    breakdown: {
      dm: {
        lactation: round2(req.breakdown.dm.lactation * factor),
        pregnancy: round2(req.breakdown.dm.pregnancy * factor),
        heiferGrowth: round2(req.breakdown.dm.heiferGrowth * factor),
        bcsAdjustment: round2(req.breakdown.dm.bcsAdjustment * factor),
      },
      me: {
        maintenance: round2(req.breakdown.me.maintenance * factor),
        milk: round2(req.breakdown.me.milk * factor),
        pregnancy: round2(req.breakdown.me.pregnancy * factor),
        heiferGrowth: round2(req.breakdown.me.heiferGrowth * factor),
      },
      cp: {
        maintenance: round2(req.breakdown.cp.maintenance * factor),
        milk: round2(req.breakdown.cp.milk * factor),
        pregnancy: round2(req.breakdown.cp.pregnancy * factor),
        heiferGrowth: round2(req.breakdown.cp.heiferGrowth * factor),
      },
    },
  };
}
