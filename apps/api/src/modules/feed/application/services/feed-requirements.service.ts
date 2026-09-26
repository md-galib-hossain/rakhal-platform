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
import { aggregateRequirements } from '../../domain/requirement-aggregate';
import {
  isManualStale,
  ManualDynamicSnapshot,
  requirementsFromManual,
} from '../../domain/manual-requirement';
import { RequirementSettings } from '../../domain/requirement-settings';
import { FeedRequirementsQueryDto } from '../../presentation/dto/feed-requirements-query.dto';
import { RequirementSettingsService } from './requirement-settings.service';
import { FeedPlanResolverService } from './feed-plan-resolver.service';
import { bandsFromSettings } from '../../domain/program-fit';
import { DEFAULT_REQUIREMENT_SETTINGS } from '../../domain/requirement-settings';

const MS_PER_DAY = 86_400_000;

/** The slice of a `CattleRequirementOverride` row the resolver reads (MILESTONE 28). */
export interface OverrideRow {
  id: string;
  dmKg: number;
  cpKg: number;
  meMj: number;
  note: string | null;
  dynamicSnapshot: unknown;
  effectiveFrom: Date;
  setBy: string;
}

export interface ManualInfo {
  override_id: string;
  set_at: Date;
  set_by: string;
  note: string | null;
  stale: boolean;
  drift: { dm_pct: number; cp_pct: number; me_pct: number };
  animal_type_changed: boolean;
}

/** One cow's requirement after the source decision (MILESTONE 28 D4/D5/D7). */
export interface ResolvedRequirement {
  source: 'DYNAMIC' | 'MANUAL';
  requirements: Requirements;
  /** What the engine says today; present only when `source` is MANUAL. */
  dynamicRequirements: Requirements | null;
  /** Data-quality only — `[]` when MANUAL, because no live input is used (D7). */
  flags: string[];
  manual: ManualInfo | null;
}

export interface ResolvedCow extends ResolvedRequirement {
  cattleId: string;
  inputs: Record<string, unknown>;
}

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

  /**
   * A requirement for hand-entered figures (no animal), shaped like one `forCattle` cow so callers can treat both
   * alike — used by the plan editor's scratchpad ("what would a 450 kg, 15 L cow need?"). Nothing is stored. There are
   * no data-quality flags: every input is the farmer's own, none is assumed.
   */
  async forManual(farmId: string, query: FeedRequirementsQueryDto) {
    const [manual, settings] = await Promise.all([
      this.calcManual(query, farmId),
      this.requirementSettings.resolve(farmId),
    ]);
    return {
      cattle_id: null as string | null,
      inputs: manual.inputs,
      flags: [] as string[],
      requirements: manual.requirements,
      bands: bandsFromSettings(settings),
    };
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
    const [settings, overrides] = await Promise.all([
      this.requirementSettings.resolve(farmId),
      this.overridesFor(farmId, [cattleId], now),
    ]);
    const resolved = this.resolveCow(
      computeRequirements(input, settings),
      animalType,
      [],
      overrides.get(cattleId),
      settings,
    );

    return {
      // The query's weight/BCS/dim inputs only shape `dynamic_requirements` for a manual cow (D4).
      source: resolved.source,
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
      requirements: this.reqShape(resolved.requirements),
      ...this.manualShape(resolved),
    };
  }

  /**
   * MILESTONE 28 D8: the manual override in force per cow at `boundary` — the row open at that instant (for a
   * past date, the start of the day after it, so a day shows the state at its end). One query. The newest row
   * wins when a day had several edits.
   */
  private async overridesFor(
    farmId: string,
    cattleIds: string[],
    boundary: Date,
  ): Promise<Map<string, OverrideRow>> {
    const out = new Map<string, OverrideRow>();
    if (cattleIds.length === 0) return out;
    const rows = await this.prisma.cattleRequirementOverride.findMany({
      where: {
        farmId,
        cattleId: { in: cattleIds },
        effectiveFrom: { lte: boundary },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: boundary } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
    });
    for (const r of rows) if (!out.has(r.cattleId)) out.set(r.cattleId, r);
    return out;
  }

  /** The only place that decides a cow's requirement source (MILESTONE 28 D4/D5/D7). */
  private resolveCow(
    dynamicReq: Requirements,
    animalType: AnimalType,
    flags: string[],
    override: OverrideRow | undefined,
    settings: RequirementSettings,
  ): ResolvedRequirement {
    if (!override) {
      return {
        source: 'DYNAMIC',
        requirements: dynamicReq,
        dynamicRequirements: null,
        flags,
        manual: null,
      };
    }
    const staleness = isManualStale(
      override.dynamicSnapshot as ManualDynamicSnapshot,
      dynamicReq,
      animalType,
      settings.manualOverrideDriftPct,
    );
    return {
      source: 'MANUAL',
      requirements: requirementsFromManual(override, settings),
      dynamicRequirements: dynamicReq,
      flags: [],
      manual: {
        override_id: override.id,
        set_at: override.effectiveFrom,
        set_by: override.setBy,
        note: override.note,
        ...staleness,
      },
    };
  }

  /** `dynamic_requirements` + `manual`, present only for a manual cow (§5 shape). */
  private manualShape(r: ResolvedRequirement) {
    return r.source === 'MANUAL' && r.dynamicRequirements
      ? {
          dynamic_requirements: this.reqShape(r.dynamicRequirements),
          manual: r.manual,
        }
      : {};
  }

  /** Per-cow API shape shared by `forCattle` rows (§5). */
  private cowShape(c: ResolvedCow) {
    return {
      cattle_id: c.cattleId,
      source: c.source,
      inputs: c.inputs,
      flags: c.flags,
      requirements: this.reqShape(c.requirements),
      ...this.manualShape(c),
    };
  }

  /**
   * What the whole active herd needs today, from live cattle records (RAKHAL-412).
   *
   * Averages weight/milk/BCS across every active cow. Returns `null` for a farm with no
   * cattle — the caller reports that rather than inventing a number.
   */
  private async herdRequirementBlock(farmId: string) {
    const herd = await this.prisma.cattle.findMany({
      where: activeHerd(farmId),
      select: { id: true },
    });
    if (herd.length === 0) return null;

    // MILESTONE 28 D9 (closes RD-110): the herd need is the sum of each cow's *resolved* requirement — a manual
    // override wins, and DIM/pregnancy/animal type count — not one engine call on the herd's average inputs.
    const { cows } = await this.resolveMany(
      farmId,
      herd.map((c) => c.id),
    );
    const manualCows = cows.filter((c) => c.source === 'MANUAL');
    // A dynamic cow with no recorded weight was priced at the farm default weight (`weight_estimated`).
    const weighed = cows.filter(
      (c) => c.source === 'MANUAL' || !c.flags.includes('weight_estimated'),
    );
    if (weighed.length === 0) return null;

    const agg = aggregateRequirements(cows.map((c) => c.requirements));
    const mean = (values: number[]) =>
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
    const num = (c: ResolvedCow, k: string) =>
      c.inputs[k] as number | undefined;
    const weightKg = mean(
      weighed
        .map((c) => num(c, 'weight_kg'))
        .filter((v): v is number => v != null),
    ) as number;
    const yields = cows
      .map((c) => num(c, 'milk_target_l'))
      .filter((v): v is number => v != null && v > 0);
    const bcs = mean(
      cows.map((c) => num(c, 'bcs')).filter((v): v is number => v != null),
    );

    return {
      headcount: cows.length,
      manual_headcount: manualCows.length,
      ca_p_headcount: agg.caPHeadcount,
      // Informational averages of the calculated model's inputs; the requirement itself is per-cow (D9).
      inputs: {
        weight_kg: round2(weightKg),
        milk_target_l: round2(mean(yields) ?? 0),
        bcs: bcs != null ? round2(bcs) : null,
        cattle_with_weight: weighed.length,
        cattle_with_milk_data: yields.length,
      },
      data_source: {
        weight: 'cattle_record_avg',
        milk_yield: yields.length > 0 ? 'milk_log_7d_avg' : 'assumed_zero',
      },
      per_cow: this.reqShape(agg.mean),
      herd_total: this.reqShape(agg.total),
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
    const [gestationByCow, yieldByCow, overrides] = await Promise.all([
      this.gestationDaysFor(allIds),
      allIds.length > 0
        ? this.milk.averageDailyYield(farmId, allIds)
        : Promise.resolve(new Map<string, number>()),
      this.overridesFor(farmId, allIds, new Date()),
    ]);

    for (const row of scorable) {
      let req: Requirements | null = null;

      // MILESTONE 28: a manual cow's saved individual ration is scored against her manual requirement.
      const manualRow =
        row.targetType === 'INDIVIDUAL' && row.cattleId
          ? overrides.get(row.cattleId)
          : undefined;
      if (manualRow) {
        out.set(row.id, requirementsFromManual(manualRow, settings));
        continue;
      }

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
    const r = await this.resolveMany(farmId, cattleIds, date);
    return {
      date: r.date,
      cows: r.cows.map((c) => this.cowShape(c)),
      missing_cattle_ids: r.missing,
      /** The farm's alert tolerance bands (RAKHAL-458) — same settings resolve as the requirement itself. */
      bands: r.bands,
    };
  }

  /**
   * One cow, resolved (MILESTONE 28, RAKHAL-462): the §5 per-cow shape plus the calculated figures the override
   * endpoint snapshots (`dynamicSnapshot`). `null` when she is not in the active herd. Unlike `calc`, a cow with no
   * recorded weight does not throw — it is priced at the farm default and flagged `weight_estimated`.
   */
  async resolveOne(farmId: string, cattleId: string) {
    const { cows } = await this.resolveMany(farmId, [cattleId]);
    const cow = cows[0];
    if (!cow) return null;
    const calculated = cow.dynamicRequirements ?? cow.requirements;
    return {
      shaped: this.cowShape(cow),
      snapshot: {
        dm_kg: calculated.dmKg,
        cp_kg: calculated.cpKg,
        me_mj: calculated.meMj,
        animal_type: cow.inputs.animal_type as AnimalType,
        inputs: cow.inputs,
      },
    };
  }

  /**
   * `forCattle`'s domain-level twin (MILESTONE 28): every cow resolved through `resolveCow`, so a manual override
   * wins. One extra query over the calculated path — the override lookup. For a past `date` the override is the
   * one in force at the end of that day (D8).
   */
  private async resolveMany(
    farmId: string,
    cattleIds: string[],
    date?: string,
  ) {
    const asOf = date ? new Date(date) : new Date();
    const boundary = date ? new Date(asOf.getTime() + MS_PER_DAY) : asOf;
    const ids = [...new Set(cattleIds)];
    const empty = {
      date: asOf.toISOString().slice(0, 10),
      cows: [] as ResolvedCow[],
      missing: [] as string[],
      bands: bandsFromSettings(DEFAULT_REQUIREMENT_SETTINGS),
    };
    if (ids.length === 0) return empty;

    const [cattle, weighIns, settings, overrides] = await Promise.all([
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
      this.overridesFor(farmId, ids, boundary),
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

    const cows = cattle.map((c): ResolvedCow => {
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
      const resolved = this.resolveCow(
        computeRequirements(input, settings),
        animalType,
        flags,
        overrides.get(c.id),
        settings,
      );
      return {
        cattleId: c.id,
        inputs: {
          weight_kg: weightKg,
          milk_target_l: milkFromRecords ?? 0,
          gestation_days: input.gestationDays,
          bcs: input.bcs,
          dim: derivedDim ?? settings.defaultDaysInMilk,
          animal_type: animalType,
        },
        ...resolved,
      };
    });

    return {
      date: asOf.toISOString().slice(0, 10),
      cows,
      missing: ids.filter((id) => !foundIds.includes(id)),
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
      breakdown: req.breakdown
        ? {
            dm: req.breakdown.dm,
            me: req.breakdown.me,
            cp: req.breakdown.cp,
          }
        : null,
    };
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100;
