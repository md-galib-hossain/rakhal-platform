import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeedPlan, FeedPlanKind, FeedPlanLine, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';
import {
  CreateFeedPlanDto,
  FeedPlanFitQueryDto,
  FeedPlanLineDto,
  ListFeedPlansQueryDto,
  PreviewPlanFitDto,
  UpdateFeedPlanDto,
} from '../../presentation/dto/feed-plan.dto';
import { FeedLotResolver } from './feed-lot-resolver.service';
import { FeedRequirementsService } from './feed-requirements.service';
import { FeedPlanAssignmentService } from './feed-plan-assignment.service';
import { FeedPlanResolverService } from './feed-plan-resolver.service';
import {
  computeProgramFit,
  FitBands,
  toApiFit,
} from '../../domain/program-fit';
import {
  buildNutrientRows,
  computeNutrientSupply,
  PlanRequirement,
} from '../../domain/plan-nutrition';
import { FeedRequirementsQueryDto } from '../../presentation/dto/feed-requirements-query.dto';
import { NutritionValues } from '../../domain/nutrition-profile';

const round2 = (v: number) => Math.round(v * 100) / 100;
const round1 = (v: number) => Math.round(v * 10) / 10;

type PlanWithLines = FeedPlan & { lines: FeedPlanLine[] };
type Names = {
  items: Map<string, string>;
  recipes: Map<string, { name: string; kind: string }>;
};
type MadeFor = {
  madeForCattleId?: string | null;
  madeForAnimalGroupId?: string | null;
};

/**
 * Feed Plans (MILESTONE 27, RAKHAL-455, `docs/EPIC_FEED_PROGRAMS.md`). A plan is the daily feeding
 * pattern for one animal — kg as-fed per head per day — over bought `FeedItem`s and made feed
 * (concentrate/TMR recipes). Creating or editing a plan **never moves stock and never reaches the
 * Feeding page**; only Apply does (RAKHAL-456). `fit()` compares a plan's supply with the per-cow
 * requirement (`FeedRequirementsService.forCattle`, RAKHAL-454).
 */
@Injectable()
export class FeedPlanService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
    private readonly requirements: FeedRequirementsService,
    private readonly lotResolver: FeedLotResolver,
    private readonly assignments: FeedPlanAssignmentService,
    private readonly programs: FeedPlanResolverService,
  ) {
    this.log = logger.setContext(FeedPlanService.name);
  }

  // ---- CRUD ---------------------------------------------------------------

  async create(farmId: string, userId: string, dto: CreateFeedPlanDto) {
    const kind = dto.kind ?? 'PLAN';
    await this.assertMadeFor(farmId, dto);
    const names = await this.validateLines(farmId, kind, dto.lines);
    const referenceRequirement = await this.captureReference(farmId, dto);

    try {
      const plan = await this.prisma.feedPlan.create({
        data: {
          farmId,
          name: dto.name,
          kind,
          notes: dto.notes ?? null,
          madeForCattleId: dto.madeForCattleId ?? null,
          madeForAnimalGroupId: dto.madeForAnimalGroupId ?? null,
          referenceRequirement: referenceRequirement ?? Prisma.JsonNull,
          createdBy: userId,
          lines: { create: this.lineRows(farmId, dto.lines) },
        },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });
      this.log.info('Feed plan created', { farmId, planId: plan.id });
      return this.mapPlan(plan, names);
    } catch (e) {
      throw this.mapConflict(e);
    }
  }

  async update(
    farmId: string,
    userId: string,
    id: string,
    dto: UpdateFeedPlanDto,
  ) {
    const existing = await this.findActive(farmId, id);

    // Setting one "made for" reference replaces the other rather than tripping the at-most-one rule.
    const merged: MadeFor = {
      madeForCattleId: existing.madeForCattleId,
      madeForAnimalGroupId: existing.madeForAnimalGroupId,
    };
    const madeForChanged =
      dto.madeForCattleId !== undefined ||
      dto.madeForAnimalGroupId !== undefined;
    if (madeForChanged) {
      merged.madeForCattleId = dto.madeForCattleId ?? null;
      merged.madeForAnimalGroupId = dto.madeForAnimalGroupId ?? null;
      await this.assertMadeFor(farmId, merged);
    }

    const kind = dto.kind ?? existing.kind;
    // Re-validate whenever lines or kind change (a kind switch can invalidate a shortcut's shape).
    const names =
      dto.lines !== undefined || dto.kind !== undefined
        ? await this.validateLines(
            farmId,
            kind,
            dto.lines ?? existing.lines.map((l) => this.toLineDto(l)),
          )
        : await this.namesFor(farmId, existing.lines);
    const referenceRequirement = madeForChanged
      ? await this.captureReference(farmId, merged)
      : undefined;

    try {
      const plan = await this.prisma.$transaction(async (tx) => {
        if (dto.lines) {
          await tx.feedPlanLine.deleteMany({ where: { planId: id } });
          await tx.feedPlanLine.createMany({
            data: this.lineRows(farmId, dto.lines).map((l) => ({
              ...l,
              planId: id,
            })),
          });
        }
        return tx.feedPlan.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.kind !== undefined && { kind: dto.kind }),
            ...(dto.notes !== undefined && { notes: dto.notes }),
            ...(madeForChanged && {
              madeForCattleId: merged.madeForCattleId,
              madeForAnimalGroupId: merged.madeForAnimalGroupId,
              referenceRequirement: referenceRequirement ?? Prisma.JsonNull,
            }),
          },
          include: { lines: { orderBy: { sortOrder: 'asc' } } },
        });
      });
      this.log.info('Feed plan updated', { farmId, planId: id, userId });
      const applied = await this.assignments.appliedTo(farmId, [id]);
      return this.mapPlan(plan, names, applied.get(id));
    } catch (e) {
      throw this.mapConflict(e);
    }
  }

  async list(farmId: string, query: ListFeedPlansQueryDto) {
    const rows = await this.prisma.feedPlan.findMany({
      where: {
        farmId,
        ...(query.includeArchived ? {} : { isActive: true }),
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.search
          ? { name: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    const names = await this.namesFor(
      farmId,
      page.items.flatMap((p) => p.lines),
    );
    const applied = await this.assignments.appliedTo(
      farmId,
      page.items.map((p) => p.id),
    );
    return {
      items: page.items.map((p) => this.mapPlan(p, names, applied.get(p.id))),
      meta: page.meta,
    };
  }

  async get(farmId: string, id: string) {
    const plan = await this.prisma.feedPlan.findFirst({
      where: { id, farmId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!plan) throw new NotFoundException('Feed plan not found');
    const applied = await this.assignments.appliedTo(farmId, [id]);
    return this.mapPlan(
      plan,
      await this.namesFor(farmId, plan.lines),
      applied.get(id),
    );
  }

  /** Soft delete. Refused (409) while the plan is applied (ADR-027 corner cases) unless
   * `removeAssignments` — the "Remove from all & delete" action — which ends every active assignment
   * and archives in one transaction. */
  async archive(
    farmId: string,
    userId: string,
    id: string,
    removeAssignments = false,
  ) {
    await this.findActive(farmId, id);
    const active = await this.assignments.countActive(farmId, id);
    if (active > 0 && !removeAssignments) {
      throw new ConflictException(
        `This plan is applied to ${active} target${active === 1 ? '' : 's'}. Remove it from them first, or use "remove from all & delete".`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      if (active > 0) {
        await this.assignments.removeAllForPlan(tx, farmId, userId, id);
      }
      await tx.feedPlan.update({ where: { id }, data: { isActive: false } });
    });
    this.log.info('Feed plan archived', {
      farmId,
      planId: id,
      userId,
      removedAssignments: active,
    });
    return { id, archived: true, removed_assignments: active };
  }

  // ---- Fit (supply vs requirement) ----------------------------------------

  /**
   * What this plan supplies per head per day vs what each named cow needs. Supply per line = as-fed
   * kg × the nutrient density of the lot that would actually be fed (a bought item's FIFO-head lot;
   * a recipe's newest `FeedStock` lot with stock): DM = kg × DM%, CP = DM × CP%, ME = DM × ME/kg DM.
   * A line with no resolvable lot is reported (`density: null`) and excluded from the totals, and
   * `supply_complete: false` tells the caller the totals are a floor. Alert thresholds arrive with
   * RAKHAL-458; this returns the raw `delta_pct` only.
   */
  async fit(farmId: string, id: string, query: FeedPlanFitQueryDto) {
    const plan = await this.prisma.feedPlan.findFirst({
      where: { id, farmId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!plan) throw new NotFoundException('Feed plan not found');

    const cattleIds = query.cattleIds?.length
      ? query.cattleIds
      : plan.madeForCattleId
        ? [plan.madeForCattleId]
        : [];
    if (cattleIds.length === 0) {
      throw new BadRequestException(
        'Pass cattleIds — this plan has no "made for" animal to default to',
      );
    }

    const [req, lines] = await Promise.all([
      this.requirements.forCattle(farmId, cattleIds, query.date),
      this.resolveSupply(farmId, plan),
    ]);
    const { supply, supplyComplete, cowFit } = this.fitBuilder(
      lines,
      req.bands,
    );

    return {
      plan_id: plan.id,
      date: req.date,
      lines,
      supply,
      supply_complete: supplyComplete,
      cows: req.cows.map((c) => ({ cattle_id: c.cattle_id, ...cowFit(c) })),
      missing_cattle_ids: req.missing_cattle_ids,
    };
  }

  /**
   * "Does this plan fit?" for lines that are NOT saved yet — the plan editor's scratchpad, so a farmer sees the
   * animal's requirement and how the feeds add up while building, like the TMR builder. The animal is one saved cow
   * (`cattleId`) or hand-entered figures (`manual`); a plan itself never stores either. Read-only.
   */
  async previewFit(farmId: string, dto: PreviewPlanFitDto) {
    if (!!dto.cattleId === !!dto.manual) {
      throw new BadRequestException(
        'Pass exactly one of cattleId (a saved animal) or manual (weight and milk you enter)',
      );
    }

    // `resolveSupply` only reads id/lineType/feedItemId/concentrationId/kgPerDay from a line.
    const previewLines = dto.lines.map((l, i) => ({
      id: `preview-${i}`,
      lineType: l.lineType,
      feedItemId: l.lineType === 'FEED_ITEM' ? (l.feedItemId ?? null) : null,
      concentrationId:
        l.lineType === 'PREPARED' ? (l.concentrationId ?? null) : null,
      kgPerDay: l.kgPerDay,
      sortOrder: i,
    })) as unknown as FeedPlanLine[];

    const [lines, animal] = await Promise.all([
      this.resolveSupply(farmId, { lines: previewLines }),
      dto.cattleId
        ? this.requirements
            .forCattle(farmId, [dto.cattleId])
            .then((r) => ({ cow: r.cows[0] ?? null, bands: r.bands }))
        : this.requirements
            .forManual(farmId, dto.manual as FeedRequirementsQueryDto)
            .then((r) => ({ cow: r, bands: r.bands })),
    ]);
    if (!animal.cow) throw new NotFoundException('Animal not found');

    const { supply, supplyComplete, cowFit } = this.fitBuilder(
      lines,
      animal.bands,
    );
    return {
      lines,
      supply,
      supply_complete: supplyComplete,
      ...cowFit(animal.cow),
    };
  }

  /**
   * Shared by `fit()` and `previewFit()`: totals what the lines supply once, then judges any cow's requirement
   * against it — DM/CP/ME with the farm's alert bands, plus every other nutrient the lots carry.
   */
  private fitBuilder(
    lines: Awaited<ReturnType<FeedPlanService['resolveSupply']>>,
    bands: FitBands,
  ) {
    const total = lines.reduce(
      (t, l) => ({
        as_fed_kg: t.as_fed_kg + l.supply.as_fed_kg,
        dm_kg: t.dm_kg + (l.supply.dm_kg ?? 0),
        cp_kg: t.cp_kg + (l.supply.cp_kg ?? 0),
        me_mj: t.me_mj + (l.supply.me_mj ?? 0),
      }),
      { as_fed_kg: 0, dm_kg: 0, cp_kg: 0, me_mj: 0 },
    );
    const supply = {
      as_fed_kg: round2(total.as_fed_kg),
      dm_kg: round2(total.dm_kg),
      cp_kg: round2(total.cp_kg),
      me_mj: round2(total.me_mj),
    };
    const supplyComplete = lines.every((l) => l.density != null);
    const delta = (have: number, need: number) =>
      need > 0 ? round1((have / need - 1) * 100) : null;
    // Every nutrient the lots carry (fat, NDF, ADF, TDN, Ca, P, RDP/RUP, starch), not only DM/CP/ME.
    const nutrientSupply = computeNutrientSupply(
      lines.map((l) => ({ kgPerDay: l.kg_per_day, profile: l.nutrition })),
    );

    const cowFit = (c: {
      requirements: PlanRequirement;
      flags: string[];
      inputs: unknown;
      /** MILESTONE 28 — present on rows from `forCattle`; a manual cow also carries the calculated figures. */
      source?: 'DYNAMIC' | 'MANUAL';
      dynamic_requirements?: unknown;
      manual?: unknown;
    }) => ({
      source: c.source ?? 'DYNAMIC',
      ...(c.manual
        ? { dynamic_requirements: c.dynamic_requirements, manual: c.manual }
        : {}),
      requirement: {
        dm_kg: c.requirements.dm_kg,
        cp_kg: c.requirements.cp_kg,
        me_mj: c.requirements.me_mj,
      },
      // The whole requirement (every nutrient), so the editor can show what she needs before any feed is added.
      requirement_full: c.requirements,
      delta_pct: {
        dm: delta(supply.dm_kg, c.requirements.dm_kg),
        cp: delta(supply.cp_kg, c.requirements.cp_kg),
        me: delta(supply.me_mj, c.requirements.me_mj),
      },
      // RAKHAL-458: severity against the farm's tolerance bands; `estimated` when any input was an
      // assumption or a line has no resolvable lot.
      fit: toApiFit(
        computeProgramFit(
          { dmKg: supply.dm_kg, cpKg: supply.cp_kg, meMj: supply.me_mj },
          {
            dmKg: c.requirements.dm_kg,
            cpKg: c.requirements.cp_kg,
            meMj: c.requirements.me_mj,
          },
          bands,
          c.flags.length > 0 || !supplyComplete,
        ),
      ),
      nutrients: buildNutrientRows(nutrientSupply, c.requirements, bands),
      inputs: c.inputs,
      flags: c.flags,
    });
    return { supply, supplyComplete, cowFit };
  }

  /** The program a cow is on right now, with each line's resolved source/density/stock (RAKHAL-458) —
   * for the cattle Feeding tab ("on program X via her group", Remove program). `{ program: null }`
   * when nothing is applied to her. */
  async programForCattle(farmId: string, cattleId: string) {
    const cow = await this.prisma.cattle.findFirst({
      where: { id: cattleId, ...activeHerd(farmId) },
      select: { id: true },
    });
    if (!cow) throw new NotFoundException('Cattle not found');
    const program = (
      await this.programs.resolveForCattle(farmId, [cattleId])
    ).get(cattleId);
    if (!program) return { program: null };
    const lines = await this.resolveSupply(farmId, { lines: program.lines });
    return {
      program: {
        assignment_id: program.assignmentId,
        plan_id: program.planId,
        plan_name: program.planName,
        kind: program.kind,
        via: program.via,
        group_id: program.groupId ?? null,
        conflict: program.conflict,
        lines: lines.map((l) => ({
          line_id: l.line_id,
          line_type: l.line_type,
          name: l.name,
          kg_per_day: l.kg_per_day,
          source: l.source,
          density: l.density,
          stock_ok: l.stock_ok,
        })),
      },
    };
  }

  // ---- internals ----------------------------------------------------------

  /** Per-line resolved lot + density + stock for a plan's lines (used by `fit()` and the Feeding Grid's
   * program sections). `source` is the concrete thing a feeding would draw: the bought item itself, or a
   * recipe's newest `FeedStock` lot with stock (else its newest lot; `null` when the recipe has none). */
  async resolveSupply(farmId: string, plan: { lines: FeedPlanLine[] }) {
    const itemLines = plan.lines.filter((l) => l.feedItemId);
    const recipeLines = plan.lines.filter((l) => l.concentrationId);
    const names = await this.namesFor(farmId, plan.lines);

    const [items, stocks] = await Promise.all([
      this.prisma.feedItem.findMany({
        where: {
          farmId,
          id: { in: itemLines.map((l) => l.feedItemId as string) },
        },
        select: {
          id: true,
          batches: {
            where: { deletedAt: null },
            // Same order the lot resolver uses, so `nutrition` below is the very lot `density` came from.
            orderBy: [{ purchaseDate: 'asc' }, { createdAt: 'asc' }],
            select: { currentStock: true, nutritionProfile: true },
          },
        },
      }),
      this.prisma.feedStock.findMany({
        where: {
          farmId,
          deletedAt: null,
          sourceConcentrationId: {
            in: recipeLines.map((l) => l.concentrationId as string),
          },
        },
        orderBy: { producedAt: 'desc' },
        include: { nutritionProfile: true },
      }),
    ]);
    const effective = await this.lotResolver.effectiveLines(
      farmId,
      itemLines.map((l) => ({ ingredientId: null, feedItemId: l.feedItemId })),
    );
    const itemById = new Map(items.map((i) => [i.id, i]));

    return plan.lines.map((l) => {
      let density: {
        dm_pct: number;
        cp_pct: number;
        me_mj_per_kg_dm: number;
      } | null = null;
      let stockOk = false;
      let name = '';
      // The raw lot profile (`null` = an unmeasured nutrient, never 0) for the full nutrition check.
      let nutrition: NutritionValues | null = null;
      let source: {
        source_type: 'FEED_ITEM' | 'FEED_STOCK';
        feed_item_id: string | null;
        feed_stock_id: string | null;
      } | null = null;

      if (l.feedItemId) {
        name = names.items.get(l.feedItemId) ?? l.feedItemId;
        const eff = effective.get(l.feedItemId);
        if (eff) {
          density = {
            dm_pct: eff.dmPct,
            cp_pct: eff.cpPct,
            me_mj_per_kg_dm: eff.meMjPerKgDm,
          };
        }
        const batches = itemById.get(l.feedItemId)?.batches ?? [];
        stockOk = batches.some((b) => b.currentStock > 0);
        const head =
          batches.find((b) => b.currentStock > 0) ??
          batches[batches.length - 1];
        nutrition = head?.nutritionProfile ?? null;
        source = {
          source_type: 'FEED_ITEM',
          feed_item_id: l.feedItemId,
          feed_stock_id: null,
        };
      } else {
        name = names.recipes.get(l.concentrationId as string)?.name ?? '';
        const lots = stocks.filter(
          (s) => s.sourceConcentrationId === l.concentrationId,
        );
        const lot = lots.find((s) => s.currentStockKg > 0) ?? lots[0];
        if (lot) {
          nutrition = lot.nutritionProfile;
          density = {
            dm_pct: lot.nutritionProfile.dmPct,
            cp_pct: lot.nutritionProfile.cpPct,
            me_mj_per_kg_dm: lot.nutritionProfile.meMjPerKgDm,
          };
        }
        stockOk = lots.some((s) => s.currentStockKg > 0);
        if (lot) {
          source = {
            source_type: 'FEED_STOCK',
            feed_item_id: null,
            feed_stock_id: lot.id,
          };
        }
      }

      const dmKg = density ? l.kgPerDay * (density.dm_pct / 100) : null;
      const cpKg =
        dmKg != null && density ? dmKg * (density.cp_pct / 100) : null;
      const meMj =
        dmKg != null && density ? dmKg * density.me_mj_per_kg_dm : null;
      return {
        line_id: l.id,
        line_type: l.lineType,
        feed_item_id: l.feedItemId,
        concentration_id: l.concentrationId,
        name,
        kg_per_day: l.kgPerDay,
        density,
        source,
        stock_ok: stockOk,
        nutrition,
        supply: {
          as_fed_kg: l.kgPerDay,
          dm_kg: dmKg != null ? round2(dmKg) : null,
          cp_kg: cpKg != null ? round2(cpKg) : null,
          me_mj: meMj != null ? round2(meMj) : null,
        },
      };
    });
  }

  private async findActive(farmId: string, id: string) {
    const plan = await this.prisma.feedPlan.findFirst({
      where: { id, farmId, isActive: true },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!plan) throw new NotFoundException('Feed plan not found');
    return plan;
  }

  private lineRows(farmId: string, lines: FeedPlanLineDto[]) {
    return lines.map((l, i) => ({
      farmId,
      lineType: l.lineType,
      feedItemId: l.lineType === 'FEED_ITEM' ? (l.feedItemId ?? null) : null,
      concentrationId:
        l.lineType === 'PREPARED' ? (l.concentrationId ?? null) : null,
      kgPerDay: round2(l.kgPerDay),
      sortOrder: i,
    }));
  }

  private toLineDto(l: FeedPlanLine): FeedPlanLineDto {
    return {
      lineType: l.lineType,
      feedItemId: l.feedItemId ?? undefined,
      concentrationId: l.concentrationId ?? undefined,
      kgPerDay: l.kgPerDay,
    };
  }

  /**
   * Every line must be feedable and deductible: a live bought `FeedItem` of this farm, or a live
   * concentrate/TMR recipe of this farm (never a catalogue-only ingredient). A target may appear once.
   * Shortcut kinds are exactly one PREPARED line of the matching recipe kind.
   */
  private async validateLines(
    farmId: string,
    kind: FeedPlanKind,
    lines: FeedPlanLineDto[],
  ): Promise<Names> {
    const seen = new Set<string>();
    for (const l of lines) {
      const key =
        l.lineType === 'FEED_ITEM'
          ? `i:${l.feedItemId}`
          : `c:${l.concentrationId}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          'A feed item or recipe can appear in a plan only once — combine the quantities',
        );
      }
      seen.add(key);
    }

    const itemIds = lines
      .filter((l) => l.lineType === 'FEED_ITEM')
      .map((l) => l.feedItemId as string);
    const recipeIds = lines
      .filter((l) => l.lineType === 'PREPARED')
      .map((l) => l.concentrationId as string);
    const [items, recipes] = await Promise.all([
      this.prisma.feedItem.findMany({
        where: { farmId, deletedAt: null, id: { in: itemIds } },
        select: { id: true, name: true },
      }),
      this.prisma.feedConcentration.findMany({
        where: { farmId, deletedAt: null, id: { in: recipeIds } },
        select: { id: true, name: true, kind: true },
      }),
    ]);
    const missingItems = itemIds.filter((i) => !items.some((x) => x.id === i));
    if (missingItems.length) {
      throw new BadRequestException(
        `Feed item not found in this farm's inventory: ${missingItems.join(', ')}`,
      );
    }
    const missingRecipes = recipeIds.filter(
      (i) => !recipes.some((x) => x.id === i),
    );
    if (missingRecipes.length) {
      throw new BadRequestException(
        `Concentrate/TMR recipe not found in this farm: ${missingRecipes.join(', ')}`,
      );
    }

    if (kind !== 'PLAN') {
      const want =
        kind === 'TMR_SHORTCUT' ? 'FEED_MIXTURE' : 'CONCENTRATE_TEMPLATE';
      const only = lines.length === 1 && lines[0].lineType === 'PREPARED';
      const recipe = only ? recipes.find((r) => r.id === recipeIds[0]) : null;
      if (!only || recipe?.kind !== want) {
        throw new BadRequestException(
          `${kind} must be exactly one PREPARED line pointing at a ${
            want === 'FEED_MIXTURE' ? 'TMR (feed mixture)' : 'concentrate'
          } recipe`,
        );
      }
    }

    return {
      items: new Map(items.map((i) => [i.id, i.name])),
      recipes: new Map(
        recipes.map((r) => [r.id, { name: r.name, kind: r.kind }]),
      ),
    };
  }

  private async namesFor(
    farmId: string,
    lines: Pick<FeedPlanLine, 'feedItemId' | 'concentrationId'>[],
  ): Promise<Names> {
    const itemIds = [
      ...new Set(
        lines.map((l) => l.feedItemId).filter((x): x is string => !!x),
      ),
    ];
    const recipeIds = [
      ...new Set(
        lines.map((l) => l.concentrationId).filter((x): x is string => !!x),
      ),
    ];
    // Names resolve even for archived items/recipes: an existing plan must stay readable.
    const [items, recipes] = await Promise.all([
      this.prisma.feedItem.findMany({
        where: { farmId, id: { in: itemIds } },
        select: { id: true, name: true },
      }),
      this.prisma.feedConcentration.findMany({
        where: { farmId, id: { in: recipeIds } },
        select: { id: true, name: true, kind: true },
      }),
    ]);
    return {
      items: new Map(items.map((i) => [i.id, i.name])),
      recipes: new Map(
        recipes.map((r) => [r.id, { name: r.name, kind: r.kind }]),
      ),
    };
  }

  /** At most one "made for" reference, and it must belong to this farm. */
  private async assertMadeFor(farmId: string, ref: MadeFor) {
    if (ref.madeForCattleId && ref.madeForAnimalGroupId) {
      throw new BadRequestException(
        'A plan can be made for one animal or one group, not both',
      );
    }
    if (ref.madeForCattleId) {
      const cow = await this.prisma.cattle.findFirst({
        where: { id: ref.madeForCattleId, ...activeHerd(farmId) },
        select: { id: true },
      });
      if (!cow) throw new NotFoundException('Cattle not found');
    }
    if (ref.madeForAnimalGroupId) {
      const group = await this.prisma.animalGroup.findFirst({
        where: { id: ref.madeForAnimalGroupId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!group) throw new NotFoundException('Animal group not found');
    }
  }

  /** Snapshot of the requirement this plan was made against (`referenceRequirement`), so the UI can
   * show drift later. Cow → her own requirement; group → the members' average. `null` when no
   * reference is set or nothing could be computed. */
  private async captureReference(
    farmId: string,
    ref: MadeFor,
  ): Promise<Prisma.InputJsonValue | null> {
    let ids: string[] = [];
    let basis: 'COW' | 'GROUP_AVERAGE' | null = null;
    if (ref.madeForCattleId) {
      ids = [ref.madeForCattleId];
      basis = 'COW';
    } else if (ref.madeForAnimalGroupId) {
      const members = await this.prisma.animalGroupMember.findMany({
        where: { groupId: ref.madeForAnimalGroupId, farmId },
        select: { cattleId: true },
      });
      ids = members.map((m) => m.cattleId);
      basis = 'GROUP_AVERAGE';
    }
    if (!basis || ids.length === 0) return null;

    const res = await this.requirements.forCattle(farmId, ids);
    if (res.cows.length === 0) return null;
    const avg = (pick: (c: (typeof res.cows)[number]) => number) =>
      round2(res.cows.reduce((s, c) => s + pick(c), 0) / res.cows.length);
    return {
      basis,
      headcount: res.cows.length,
      captured_at: new Date().toISOString(),
      dm_kg: avg((c) => c.requirements.dm_kg),
      cp_kg: avg((c) => c.requirements.cp_kg),
      me_mj: avg((c) => c.requirements.me_mj),
    };
  }

  private mapConflict(e: unknown): unknown {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return new ConflictException(
        'A feed plan with this name already exists — pick another name',
      );
    }
    return e;
  }

  private mapPlan(
    plan: PlanWithLines,
    names: Names,
    appliedTo?: { cattle_ids: string[]; group_ids: string[]; herd: boolean },
  ) {
    const lines = plan.lines.map((l) => ({
      id: l.id,
      line_type: l.lineType,
      feed_item_id: l.feedItemId,
      concentration_id: l.concentrationId,
      name: l.feedItemId
        ? (names.items.get(l.feedItemId) ?? null)
        : (names.recipes.get(l.concentrationId as string)?.name ?? null),
      recipe_kind: l.concentrationId
        ? (names.recipes.get(l.concentrationId)?.kind ?? null)
        : null,
      kg_per_day: l.kgPerDay,
      sort_order: l.sortOrder,
    }));
    return {
      id: plan.id,
      name: plan.name,
      kind: plan.kind,
      notes: plan.notes,
      made_for_cattle_id: plan.madeForCattleId,
      made_for_animal_group_id: plan.madeForAnimalGroupId,
      reference_requirement: plan.referenceRequirement,
      is_active: plan.isActive,
      applied_to: appliedTo ?? { cattle_ids: [], group_ids: [], herd: false },
      lines,
      total_kg_per_day: round2(lines.reduce((s, l) => s + l.kg_per_day, 0)),
      created_at: plan.createdAt,
      updated_at: plan.updatedAt,
    };
  }
}
