import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
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

const MS_PER_DAY = 86_400_000;

/** Nutritional-requirements calculator (PRD §12.4, RAKHAL-081). Thin wrapper over the pure domain,
 * plus (2026-07-17, user request) two cow-driven modes that auto-derive `weightKg`/`milkTargetL`/
 * `gestationDays`/`bcs` from real cattle/reproduction/milk records instead of manual entry:
 * `cattleId` (single cow) or `feedGroupId` (group average + group total). Falls back to the manual
 * `weightKg`/`milkTargetL` query fields when a cow's records are incomplete, so this never silently
 * fabricates a number — every derived input is flagged in the response's `data_source` block. */
@Injectable()
export class FeedRequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly milk: MilkService,
    private readonly requirementSettings: RequirementSettingsService,
  ) {}

  async calc(farmId: string, query: FeedRequirementsQueryDto) {
    if (query.cattleId)
      return this.calcForCattle(farmId, query.cattleId, query);
    if (query.feedGroupId)
      return this.calcForFeedGroup(farmId, query.feedGroupId, query);
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

  /** MILKING/FRESH → lactating cow; DRY → dry cow; GROWING → heifer (young stock, not yet
   * in production). SOLD/DECEASED cows are excluded upstream (`deletedAt` scoping) and
   * default to COW here as a harmless fallback. */
  private inferAnimalType(
    productionStatus: string | null | undefined,
  ): AnimalType {
    if (productionStatus === 'DRY') return 'DRY';
    if (productionStatus === 'GROWING') return 'HEIFER';
    return 'COW';
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
      },
    });
    if (!cattle) throw new NotFoundException('Cattle not found');
    const animalType =
      query.animalType ?? this.inferAnimalType(cattle.productionStatus);

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
      dim: query.dim,
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
        dim: query.dim,
        animal_type: animalType,
      },
      data_source: { weight: weightSource, milk_yield: milkSource },
      requirements: this.reqShape(req),
    };
  }

  /** Feed group — averages `weightKg`/milk yield across active members (cows missing a record are
   * skipped from that average, not zero-filled) and computes both a per-cow requirement (from the
   * averaged inputs) and a group total (per-cow × headcount, what a batch-production quantity
   * needs). */
  private async calcForFeedGroup(
    farmId: string,
    feedGroupId: string,
    query: FeedRequirementsQueryDto,
  ) {
    const group = await this.prisma.feedGroup.findFirst({
      where: { id: feedGroupId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!group) throw new NotFoundException('Feed group not found');

    const cattle = await this.prisma.cattle.findMany({
      where: { ...activeHerd(farmId), feedGroupId },
      select: { id: true, lastWeightKg: true, lastBcs: true },
    });
    const headcount = cattle.length;
    if (headcount === 0) {
      throw new BadRequestException('Feed group has no active cattle');
    }

    const cattleIds = cattle.map((c) => c.id);
    const avgYieldByCow = await this.milk.averageDailyYield(farmId, cattleIds);

    const weights = cattle
      .map((c) => c.lastWeightKg)
      .filter((w): w is number => w != null);
    const bcsValues = cattle
      .map((c) => c.lastBcs)
      .filter((b): b is number => b != null);
    const yields = cattleIds
      .map((id) => avgYieldByCow.get(id))
      .filter((y): y is number => y != null);

    const avg = (values: number[]) =>
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : undefined;

    const weightKg = avg(weights) ?? query.weightKg;
    if (weightKg == null) {
      throw new BadRequestException(
        'No cattle in this group have a recorded weight — supply weightKg manually',
      );
    }
    const milkTargetL = avg(yields) ?? query.milkTargetL ?? 0;
    const bcs = avg(bcsValues);

    const settings = await this.requirementSettings.resolve(farmId);
    const req = computeRequirements(
      {
        weightKg,
        milkTargetL,
        milkFatPct: query.milkFatPct,
        milkProteinPct: query.milkProteinPct,
        gestationDays: query.gestationDays,
        bcs: query.bcs ?? bcs,
        dim: query.dim,
        animalType: query.animalType,
      },
      settings,
    );

    return {
      inputs: {
        weight_kg: round2(weightKg),
        milk_target_l: round2(milkTargetL),
        milk_fat_pct: query.milkFatPct ?? 4.0,
        bcs:
          (query.bcs ?? bcs) != null
            ? round2((query.bcs ?? bcs) as number)
            : null,
        animal_type: query.animalType ?? 'COW',
        headcount,
        cattle_with_weight: weights.length,
        cattle_with_milk_data: yields.length,
      },
      data_source: {
        weight: weights.length > 0 ? 'cattle_record_avg' : 'manual',
        milk_yield:
          yields.length > 0
            ? 'milk_log_7d_avg'
            : query.milkTargetL != null
              ? 'manual'
              : 'assumed_zero',
      },
      per_cow: this.reqShape(req),
      group_total: this.reqShape(scaleRequirements(req, headcount)),
    };
  }

  /**
   * What the whole active herd needs today, from live cattle records (RAKHAL-412).
   *
   * The same averaging `calcForFeedGroup` does, across every active cow instead of one
   * group. Returns `null` for a farm with no cattle — the caller reports that rather than
   * inventing a number.
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
   * Per-feed-group requirement for every group that has cattle in it (RAKHAL-412).
   * Groups with no active cattle are skipped rather than reported as zero.
   */
  private async groupRequirementBlocks(farmId: string) {
    const groups = await this.prisma.feedGroup.findMany({
      where: { farmId, deletedAt: null },
      select: { id: true, name: true },
    });

    const blocks = await Promise.all(
      groups.map(async (g) => {
        try {
          const res = await this.calcForFeedGroup(farmId, g.id, {});
          return {
            feed_group_id: g.id,
            name: g.name,
            headcount: res.inputs.headcount,
            per_cow: res.per_cow,
            group_total: res.group_total,
            data_source: res.data_source,
          };
        } catch {
          // An empty group, or one whose cattle have no recorded weight, has nothing to
          // compute from — omit it rather than reporting a fabricated zero.
          return null;
        }
      }),
    );

    return blocks.filter((b): b is NonNullable<typeof b> => b !== null);
  }

  /**
   * Farm-wide "Today's Feed Requirement" rollup (2026-08-13, user request — doc's §5/§12
   * mockup: "Corn silage 300kg, Grass 180kg..."). Every active `FEED_MIXTURE` concentration's
   * per-cow-per-day ingredient lines, multiplied by that ration's resolved headcount (GROUP =
   * active cattle in that `feedGroupId`, INDIVIDUAL = 1, HERD = whole active herd), aggregated
   * by ingredient across every ration on the farm. Read-only aggregation, no persisted state.
   */
  async getTodaysRequirement(farmId: string) {
    const [rations, requirement, byGroupRequirement] = await Promise.all([
      this.prisma.feedConcentration.findMany({
        where: { farmId, deletedAt: null, kind: 'FEED_MIXTURE' },
        include: { items: true },
      }),
      this.herdRequirementBlock(farmId),
      this.groupRequirementBlocks(farmId),
    ]);

    // RAKHAL-412: what the animals need is computed from live cattle records and is
    // returned whether or not a ration exists. Before this, a farm with no TMR got an
    // empty payload and the Feeding page told it to go build one first — the requirement
    // does not depend on having a ration, only on having cows.
    if (rations.length === 0) {
      return {
        by_ingredient: [],
        by_group: [],
        grand_total_kg: 0,
        requirement,
        by_group_requirement: byGroupRequirement,
        has_active_ration: false,
      };
    }

    const groupIds = [
      ...new Set(
        rations
          .filter((r) => r.targetType === 'GROUP' && r.feedGroupId)
          .map((r) => r.feedGroupId as string),
      ),
    ];
    const [groupCounts, herdCount, groups, ingredientNames] = await Promise.all(
      [
        this.prisma.cattle.groupBy({
          by: ['feedGroupId'],
          where: {
            ...activeHerd(farmId),
            feedGroupId: { in: groupIds },
          },
          _count: { _all: true },
        }),
        this.prisma.cattle.count({
          where: activeHerd(farmId),
        }),
        this.prisma.feedGroup.findMany({
          where: { farmId, id: { in: groupIds } },
          select: { id: true, name: true },
        }),
        this.prisma.feedIngredient.findMany({
          where: {
            id: {
              in: [
                ...new Set(
                  rations.flatMap((r) =>
                    r.items
                      .map((i) => i.ingredientId)
                      .filter((id): id is string => id != null),
                  ),
                ),
              ],
            },
          },
          select: { id: true, nameEn: true },
        }),
      ],
    );
    const headcountByGroup = new Map(
      groupCounts.map((g) => [g.feedGroupId as string, g._count._all]),
    );
    const groupNameById = new Map(groups.map((g) => [g.id, g.name]));
    const nameByIngredient = new Map(
      ingredientNames.map((i) => [i.id, i.nameEn]),
    );
    // RAKHAL-447: a line that names only an inventory product is grouped under the product's id.
    const productIds = [
      ...new Set(
        rations.flatMap((r) =>
          r.items.filter((i) => !i.ingredientId).map((i) => i.feedItemId),
        ),
      ),
    ].filter((id): id is string => id != null);
    if (productIds.length > 0) {
      const products = await this.prisma.feedItem.findMany({
        where: { farmId, id: { in: productIds } },
        select: { id: true, name: true },
      });
      for (const p of products) nameByIngredient.set(p.id, p.name);
    }

    const totalsByIngredient = new Map<string, number>();
    const byGroup: {
      feed_group_id: string | null;
      name: string;
      headcount: number;
      total_kg: number;
    }[] = [];

    for (const ration of rations) {
      const headcount =
        ration.targetType === 'INDIVIDUAL'
          ? 1
          : ration.targetType === 'GROUP'
            ? (headcountByGroup.get(ration.feedGroupId ?? '') ?? 0)
            : herdCount;
      if (headcount <= 0) continue;

      let rationTotalKg = 0;
      for (const item of ration.items) {
        const kg = round2(item.amountKg * headcount);
        rationTotalKg += kg;
        const key = item.ingredientId ?? item.feedItemId;
        if (!key) continue;
        totalsByIngredient.set(
          key,
          round2((totalsByIngredient.get(key) ?? 0) + kg),
        );
      }

      byGroup.push({
        feed_group_id: ration.feedGroupId,
        name:
          ration.targetType === 'HERD'
            ? 'Whole Herd'
            : ration.targetType === 'INDIVIDUAL'
              ? ration.name
              : (groupNameById.get(ration.feedGroupId ?? '') ?? ration.name),
        headcount,
        total_kg: round2(rationTotalKg),
      });
    }

    const byIngredient = [...totalsByIngredient.entries()]
      .map(([ingredientId, totalKg]) => ({
        ingredient_id: ingredientId,
        name: nameByIngredient.get(ingredientId) ?? ingredientId,
        total_kg: round2(totalKg),
      }))
      .sort((a, b) => b.total_kg - a.total_kg);

    return {
      by_ingredient: byIngredient,
      by_group: byGroup,
      grand_total_kg: round2(
        byIngredient.reduce((sum, i) => sum + i.total_kg, 0),
      ),
      requirement,
      by_group_requirement: byGroupRequirement,
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
   * to — directly for an INDIVIDUAL ration, via group membership for a GROUP one — and derives
   * them all together: one cattle query, one reproduction-profile query, one pregnancy query, one
   * batched milk average, one settings resolve. Adding rations does not add queries.
   *
   * Returns the raw domain object rather than the snake_case API shape, because the caller needs
   * it to score a formula. `null` where nothing can be computed: a Concentrate Mixer carries no
   * target at all, and a cow with no recorded weight has nothing to work from.
   *
   * The derivation deliberately mirrors `calcForCattle`/`calcForFeedGroup` field for field, so a
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
      feedGroupId: string | null;
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
    const groupIds = [
      ...new Set(
        scorable
          .filter((r) => r.targetType === 'GROUP' && r.feedGroupId)
          .map((r) => r.feedGroupId as string),
      ),
    ];

    // Every cow the batch touches, in one query: the individually-targeted ones plus the members
    // of every group referenced.
    const cattle =
      directCattleIds.length > 0 || groupIds.length > 0
        ? await this.prisma.cattle.findMany({
            where: {
              ...activeHerd(farmId),
              OR: [
                ...(directCattleIds.length > 0
                  ? [{ id: { in: directCattleIds } }]
                  : []),
                ...(groupIds.length > 0
                  ? [{ feedGroupId: { in: groupIds } }]
                  : []),
              ],
            },
            select: {
              id: true,
              feedGroupId: true,
              lastWeightKg: true,
              lastBcs: true,
              productionStatus: true,
            },
          })
        : [];

    const cattleById = new Map(cattle.map((c) => [c.id, c]));
    const byGroup = new Map<string, typeof cattle>();
    for (const c of cattle) {
      if (!c.feedGroupId) continue;
      const list = byGroup.get(c.feedGroupId) ?? [];
      list.push(c);
      byGroup.set(c.feedGroupId, list);
    }

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
                ? this.inferAnimalType(c.productionStatus)
                : undefined,
            },
            settings,
          );
        }
      } else if (row.targetType === 'GROUP' && row.feedGroupId) {
        const members = byGroup.get(row.feedGroupId) ?? [];
        const weights = members
          .map((m) => m.lastWeightKg)
          .filter((w): w is number => w != null);
        if (weights.length > 0) {
          const yields = members
            .map((m) => yieldByCow.get(m.id))
            .filter((y): y is number => y != null);
          const bcsValues = members
            .map((m) => m.lastBcs)
            .filter((b): b is number => b != null);
          req = computeRequirements(
            {
              // Per cow, matching what `calcForFeedGroup` reports as `per_cow` — a formula is
              // built for one animal, not for the whole group's batch.
              weightKg: avg(weights) as number,
              milkTargetL: avg(yields) ?? 0,
              bcs: avg(bcsValues) ?? undefined,
            },
            settings,
          );
        }
      }

      // HERD-targeted rations, and any of the above whose cow/group yielded nothing, fall back
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
