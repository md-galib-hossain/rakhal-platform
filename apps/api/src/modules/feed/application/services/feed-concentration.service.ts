import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FeedConcentration,
  FeedConcentrationItem,
  FeedConcentrationKind,
  FeedIngredient,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';
import {
  EffectiveIngredient,
  resolveEffective,
} from '../../domain/ingredient-resolver';
import {
  balanceScore,
  computeTotals,
  FormulaLine,
  FormulaTotals,
  normalize,
} from '../../domain/formula-math';
import { computeRequirements, Requirements } from '../../domain/requirements';
import { RequirementSettingsService } from './requirement-settings.service';
import {
  CreateConcentrationDto,
  NormalizeConcentrationDto,
  UpdateConcentrationDto,
} from '../../presentation/dto/concentration.dto';
import { FeedStockService, StockNutritionSnapshot } from './feed-stock.service';
import { FeedRequirementsService } from './feed-requirements.service';
import { FeedDistributionService } from './feed-distribution.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { FinancialAccountService } from 'src/modules/finance-v2/accounts/application/financial-account.service';
import { randomUUID } from 'crypto';

type ConcentrationWithItems = FeedConcentration & {
  items: FeedConcentrationItem[];
};

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Concentration templates (PRD §12.3–12.4, RAKHAL-082): the formula builder.
 * Persists name + target + ingredient lines; on read, enriches with nutritional
 * totals, a 0–100 balance score vs the target's requirements, and cost — all via
 * the pure `formula-math`/`requirements` domain. `normalize` scales a draft to
 * meet the dry-matter target. Farm-scoped throughout.
 */
@Injectable()
export class FeedConcentrationService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly feedStock: FeedStockService,
    private readonly feedRequirements: FeedRequirementsService,
    private readonly requirementSettings: RequirementSettingsService,
    private readonly journalService: JournalService,
    private readonly ledgerAccountService: LedgerAccountService,
    private readonly financialAccountService: FinancialAccountService,
    private readonly feedDistribution: FeedDistributionService,
  ) {
    this.log = this.logger.setContext(FeedConcentrationService.name);
  }

  async list(
    farmId: string,
    kind?: FeedConcentrationKind,
    includeArchived = false,
  ) {
    const rows = await this.prisma.feedConcentration.findMany({
      where: {
        farmId,
        ...(includeArchived ? {} : { deletedAt: null }),
        ...(kind ? { kind } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    const finalizedIds = await this.finalizedIds(
      farmId,
      rows.map((r) => ({ id: r.id, kind: r.kind })),
    );
    // One batched resolve for the whole page (RAKHAL-411) — resolving per row would be an
    // O(N) round-trip to cattle/reproduction/milk for a list that is usually a handful of rows
    // but need not stay that way.
    // RD-079: price every ingredient on the page in one pass too. `enrich()` used to call
    // `effectiveMap()` itself, which is two queries, so listing N rations cost 2N round-trips
    // just to resolve prices — measured at 2691 for ~1345 rations, growing by exactly 2 per
    // ration added. The map is keyed by ingredient id, so one shared map serves every row.
    const [requirements, effById] = await Promise.all([
      this.feedRequirements.resolveForConcentrations(farmId, rows),
      this.effectiveMap(
        farmId,
        rows.flatMap((r) => r.items.map((i) => i.ingredientId)),
      ),
    ]);
    return Promise.all(
      rows.map((r) =>
        this.enrich(
          farmId,
          r,
          false,
          finalizedIds,
          requirements.get(r.id) ?? null,
          effById,
        ),
      ),
    );
  }

  async get(farmId: string, id: string) {
    const row = await this.getOrThrow(farmId, id);
    const finalizedIds = await this.finalizedIds(farmId, [
      { id: row.id, kind: row.kind },
    ]);
    return this.enrich(farmId, row, true, finalizedIds);
  }

  /** Which of these concentration ids have ever been finalized at least once. The two kinds
   * finalize into different things — a Concentrate Mixer is a virtual recipe/calculator that
   * never touches inventory, only ever promotes/refreshes a reusable `FeedIngredient`; a Total
   * Mixed Ration is the real ration, and finalizing one produces an actual `FeedStock` inventory
   * lot (see `finalize()`'s doc comment) — so each kind needs its own existence check, never the
   * other's. */
  private async finalizedIds(
    farmId: string,
    rows: { id: string; kind: FeedConcentrationKind }[],
  ): Promise<Set<string>> {
    const templateIds = rows
      .filter((r) => r.kind === 'CONCENTRATE_TEMPLATE')
      .map((r) => r.id);
    const mixtureIds = rows
      .filter((r) => r.kind === 'FEED_MIXTURE')
      .map((r) => r.id);
    // `in: []` is a safe no-op query (returns `[]`), so both queries can always run — no need to
    // branch on whether either id list is non-empty, which sidesteps a TS inference gotcha where a
    // ternary's two `Promise.all` branches (a real query vs `Promise.resolve([])`) collapse to `any`.
    // No `deletedAt` filter on either read (RAKHAL-310): this only asks
    // "has this concentration ever been finalized", which must stay true
    // even if the resulting ingredient/stock row was later archived.
    const [ingredientRows, stockRows] = await Promise.all([
      this.prisma.feedIngredient.findMany({
        where: { farmId, sourceConcentrationId: { in: templateIds } },
        select: { sourceConcentrationId: true },
      }),
      this.prisma.feedStock.findMany({
        where: { farmId, sourceConcentrationId: { in: mixtureIds } },
        select: { sourceConcentrationId: true },
        distinct: ['sourceConcentrationId'],
      }),
    ]);
    return new Set([
      ...ingredientRows.map((r) => r.sourceConcentrationId as string),
      ...stockRows.map((r) => r.sourceConcentrationId),
    ]);
  }

  async create(farmId: string, userId: string, dto: CreateConcentrationDto) {
    // Concentrate Mixer templates are recipes, not cow-targeted rations — force-null every target
    // field regardless of what the payload sent (belt-and-suspenders: the frontend form also never
    // shows these fields for this kind, but a template must never accidentally end up bucketed as a
    // Feed Mixture the way every concentration did before `kind` existed, user request 2026-07-18).
    const isTemplate = dto.kind === 'CONCENTRATE_TEMPLATE';
    if (!isTemplate && dto.durationDays == null) {
      throw new BadRequestException(
        'A Total Mixed Ration requires durationDays',
      );
    }
    const targetType = isTemplate ? undefined : dto.targetType;
    const feedGroupId = isTemplate ? undefined : dto.feedGroupId;
    const cattleId = isTemplate ? undefined : dto.cattleId;
    let targetWeightKg = isTemplate ? undefined : dto.targetWeightKg;
    let targetMilkL = isTemplate ? undefined : dto.targetMilkL;

    // Once a real cow/group target is picked, manual weight/milk entry is optional (user request
    // 2026-07-18) — the wizard already surfaces these live-derived values, so the backend must be
    // able to resolve them too instead of hard-rejecting whenever they're omitted. Reuses the exact
    // same cattle/group derivation `GET /feed/requirements` already exposes to the wizard's live
    // preview, so the stored value matches what the farmer actually saw on screen.
    if (!isTemplate && (targetWeightKg == null || targetMilkL == null)) {
      if (cattleId || feedGroupId) {
        const resolved = await this.feedRequirements.calc(farmId, {
          cattleId,
          feedGroupId,
          weightKg: targetWeightKg,
          milkTargetL: targetMilkL,
        });
        targetWeightKg ??= resolved.inputs.weight_kg;
        targetMilkL ??= resolved.inputs.milk_target_l;
      }
      if (targetWeightKg == null || targetMilkL == null) {
        throw new BadRequestException(
          'A Total Mixed Ration requires targetWeightKg and targetMilkL — supply them manually or target a cow/group with a real weight record',
        );
      }
    }

    await this.validateTargets(farmId, feedGroupId, cattleId);
    await this.assertIngredients(dto.items.map((i) => i.ingredientId));
    await this.assertBatchLinks(farmId, dto.items);
    if (!isTemplate) {
      await this.assertHasConcentrateDerivedLine(dto.items);
    }

    const created = await this.prisma.feedConcentration.create({
      data: {
        farmId,
        kind: dto.kind,
        name: dto.name,
        durationDays: dto.durationDays,
        targetType,
        feedGroupId,
        cattleId,
        targetWeightKg,
        targetMilkL,
        createdBy: userId,
        items: {
          create: dto.items.map((i) => ({
            ingredientId: i.ingredientId,
            amountKg: i.amountKg,
            feedItemId: i.feedItemId,
            feedStockId: i.feedStockId,
          })),
        },
      },
      include: { items: true },
    });
    this.log.info('Feed concentration created', {
      farmId,
      id: created.id,
      kind: created.kind,
    });
    return this.enrich(farmId, created, true);
  }

  /**
   * `kind` is immutable — a template can never pick up a target via edit either (same
   * defense-in-depth as `create`, see that method's comment). Live-sync (user request
   * 2026-07-18): if this template has already been finalized at least once, every save keeps its
   * promoted `FeedIngredient` in sync — no extra Finalize click needed for the change to reach
   * every TMR that already uses it. Never auto-promotes an ingredient that doesn't exist yet
   * (see `refreshPromotedIngredientIfExists`'s doc comment) — that stays a deliberate Finalize
   * action.
   */
  async update(farmId: string, id: string, dto: UpdateConcentrationDto) {
    const existing = await this.getOrThrow(farmId, id);
    const isTemplate = existing.kind === 'CONCENTRATE_TEMPLATE';
    const targetType = isTemplate ? undefined : dto.targetType;
    const feedGroupId = isTemplate ? undefined : dto.feedGroupId;
    const cattleId = isTemplate ? undefined : dto.cattleId;
    const targetWeightKg = isTemplate ? undefined : dto.targetWeightKg;
    const targetMilkL = isTemplate ? undefined : dto.targetMilkL;

    await this.validateTargets(farmId, feedGroupId, cattleId);
    if (dto.items) {
      await this.assertIngredients(dto.items.map((i) => i.ingredientId));
      await this.assertBatchLinks(farmId, dto.items);
      if (!isTemplate) {
        await this.assertHasConcentrateDerivedLine(dto.items);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.feedConcentrationItem.deleteMany({
          where: { concentrationId: id },
        });
        await tx.feedConcentrationItem.createMany({
          data: dto.items.map((i) => ({
            concentrationId: id,
            ingredientId: i.ingredientId,
            amountKg: i.amountKg,
            feedItemId: i.feedItemId,
            feedStockId: i.feedStockId,
          })),
        });
      }
      return tx.feedConcentration.update({
        where: { id },
        data: {
          name: dto.name,
          durationDays: dto.durationDays,
          targetType,
          feedGroupId,
          cattleId,
          targetWeightKg,
          targetMilkL,
        },
        include: { items: true },
      });
    });

    if (isTemplate) {
      await this.refreshPromotedIngredientIfExists(farmId, updated);
    }

    this.log.info('Feed concentration updated', { farmId, id });
    return this.enrich(farmId, updated, true);
  }

  /** Archiving a concentration must also archive any `FeedIngredient` promoted from it
   * (`finalize()`'s `sourceConcentrationId`) — otherwise the ghost ingredient keeps passing
   * `listMerged`'s `deletedAt: null` filter and stays selectable in every ingredient picker
   * forever, even though the user believes they deleted it (user report 2026-07-18). */
  async remove(farmId: string, id: string) {
    await this.getOrThrow(farmId, id);
    await this.prisma.$transaction([
      this.prisma.feedConcentration.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      this.prisma.feedIngredient.updateMany({
        where: { sourceConcentrationId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);
    this.log.info('Feed concentration archived', { farmId, id });
    return { id, archived: true };
  }

  /** Multi-select delete (user request 2026-07-18) — one `updateMany`, silently skipping any id
   * outside this farm or already inactive rather than erroring the whole batch. Also archives any
   * `FeedIngredient` promoted from these concentrations — see `remove()`'s doc comment. */
  async removeMany(farmId: string, ids: string[]) {
    const [result] = await this.prisma.$transaction([
      this.prisma.feedConcentration.updateMany({
        where: { farmId, id: { in: ids }, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.prisma.feedIngredient.updateMany({
        where: { sourceConcentrationId: { in: ids }, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);
    this.log.info('Feed concentrations bulk-archived', {
      farmId,
      requested: ids.length,
      archived: result.count,
    });
    return { deleted: result.count };
  }

  /**
   * **Concentrate Mixer** (`kind=CONCENTRATE_TEMPLATE`) is a formula builder — a farm can create
   * unlimited templates. Finalizing one promote-or-refreshes the formula into a reusable
   * `FeedIngredient` row, an **upsert by `sourceConcentrationId`**, not "always create a new frozen
   * version" (that versioning/freeze design was retired 2026-07-18 per user request: editing the
   * template must live-propagate to every TMR already using it, and since a TMR's line item
   * resolves nutrition via a live join on `ingredientId` — see `effectiveMap()` — updating this one
   * row in place is all propagation needs). RAKHAL-421 (2026-09-13, closes RD-080): finalizing a
   * Concentrate Mixer now **also** produces a `FeedStock` batch/lot (`kind: CONCENTRATE_TEMPLATE`)
   * via `FeedStockService.produceFromConcentration` — RAKHAL-406 (2026-08-28) had this produce a
   * plain Inventory `FeedItem` instead, which put two incompatible "prepared feed" shapes in the
   * database (RD-080); this unifies both kinds onto `FeedStock`, so a concentrate batch gets the
   * same `FeedStockMovement` audit trail, frozen nutrient snapshot and soft-delete a TMR batch
   * always had, and needs no "kg unit exists in the catalog" precondition (`FeedStock` is
   * kg-native). `producedQtyKg`/`currentStockKg` set from `batchQuantityKg` (defaults to the
   * formula's own `totalAsFedKg` when omitted) — every finalize call creates a **new** `FeedStock`
   * row (not an upsert, unlike the ingredient promotion above), since each finalize represents a
   * distinct physical batch the farmer mixed. `producedCostTk` is always the recipe's full
   * `total_cost_tk`, regardless of `batchQuantityKg` — that parameter scales how much of the batch
   * was produced, not the recipe's cost.
   * **Total Mixed Ration** (`kind=FEED_MIXTURE`) is the real ration actually fed to cows —
   * finalizing one produces a `FeedStock` lot the same way, but with no ingredient promotion
   * (user request 2026-07-18: a TMR is the final ration, never a building block for another
   * recipe). Producing a new physical stock batch on every finalize stays a **deliberate,
   * unconditional action** for both kinds (not idempotent — refinalizing produces another lot);
   * only the ingredient-promotion half (Concentrate Mixer only) stays idempotent. A plain
   * edit-save (`update()`) can refresh nutrition on either kind, but never produces stock.
   */
  async finalize(
    farmId: string,
    userId: string,
    id: string,
    financialAccountId?: string,
    batchQuantityKg?: number,
  ) {
    const row = await this.getOrThrow(farmId, id);
    if (row.items.length === 0) {
      throw new BadRequestException(
        'Cannot finalize an empty concentration — add ingredients first',
      );
    }

    const effById = await this.effectiveMap(
      farmId,
      row.items.map((i) => i.ingredientId),
    );
    const lines: FormulaLine[] = row.items.map((i) => ({
      ingredientId: i.ingredientId,
      amountKg: i.amountKg,
    }));
    const { totals } = computeTotals(lines, effById);
    const totalAsFedKg = row.items.reduce((sum, i) => sum + i.amountKg, 0);

    if (totalAsFedKg <= 0 || totals.dm_kg <= 0) {
      throw new BadRequestException(
        'Concentration has no measurable dry matter to promote',
      );
    }

    // RAKHAL-423/424: resolve each line's batch link (validates sufficiency + self-consumption,
    // fail-fast before anything is written) and split the recipe's real cost into what's already
    // owned (linked lines, priced from the batch's own real cost) vs what still needs buying
    // (unlinked lines, priced from the catalogue) — see `resolveBatchDeductions`'s doc comment.
    const deductions = await this.resolveBatchDeductions(
      farmId,
      row.id,
      row.items,
      effById,
    );
    const correctedTotalCostTk = round2(
      deductions.linkedCostTk + deductions.unlinkedCostTk,
    );

    // `financialAccountId` is only required when this finalize actually buys something — an
    // all-linked TMR (every line already owned) never touches cash (RAKHAL-424, closes the gap
    // RAKHAL-393/RD-077 opened by demanding it unconditionally).
    if (
      row.kind === 'FEED_MIXTURE' &&
      deductions.unlinkedCostTk > 0 &&
      !financialAccountId
    ) {
      throw new BadRequestException(
        'financialAccountId is required to finalize a Total Mixed Ration that purchases feed',
      );
    }

    let ingredientResult: ReturnType<typeof this.mapIngredient> | null = null;
    let stock: Awaited<
      ReturnType<typeof this.feedStock.produceFromConcentration>
    > | null = null;
    if (row.kind === 'CONCENTRATE_TEMPLATE') {
      const nutrition = this.buildIngredientNutrition(
        row.name,
        totals,
        totalAsFedKg,
      );
      const ingredient = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.feedIngredient.findFirst({
          where: { sourceConcentrationId: row.id },
        });
        if (existing) {
          return tx.feedIngredient.update({
            where: { id: existing.id },
            data: { ...nutrition, deletedAt: null },
          });
        }
        return tx.feedIngredient.create({
          data: {
            farmId,
            ...nutrition,
            isSystemDefault: false,
            isAvailableBd: true,
            sourceConcentrationId: row.id,
            sourceConcentrationVersion: 1,
            isLatestVersion: true,
          },
        });
      });
      this.log.info(
        'Feed concentration promoted/refreshed into a reusable ingredient',
        {
          farmId,
          concentrationId: row.id,
          ingredientId: ingredient.id,
          userId,
        },
      );
      ingredientResult = this.mapIngredient(ingredient);

      // RAKHAL-421: every finalize also produces a fresh FeedStock batch — a distinct physical
      // lot, not an upsert like the ingredient promotion above.
      const qtyKg = batchQuantityKg ?? totalAsFedKg;
      if (qtyKg <= 0) {
        throw new BadRequestException(
          'batchQuantityKg must be greater than zero',
        );
      }
      stock = await this.prisma.$transaction(async (tx) => {
        await this.applyBatchDeductions(farmId, userId, tx, deductions);
        return this.feedStock.produceFromConcentration(
          farmId,
          userId,
          {
            concentrationId: row.id,
            version: 1,
            qtyKg,
            costTk: correctedTotalCostTk,
            nutrition: this.buildStockNutritionSnapshot(totals, totalAsFedKg),
            kind: 'CONCENTRATE_TEMPLATE',
          },
          tx,
        );
      });
      this.log.info('Concentrate Mixer finalize produced a FeedStock batch', {
        farmId,
        concentrationId: row.id,
        stockId: stock.id,
        qtyKg,
        userId,
      });
    }

    // Only a Total Mixed Ration moves cash, and only for the portion it actually buys — a
    // Concentrate Mixer's stock (above) is never purchased, and RAKHAL-424 (closes RD-080's
    // double-count sibling): the linked-line portion is feed the farm already owns and already
    // paid for, so re-crediting cash for it would double-count that expense. Only the unlinked
    // portion (still priced from the catalogue, never bought yet) posts a real purchase; an
    // all-linked finalize posts no journal entry at all.
    //
    // Payment happens *before* stock is produced (mirrors the old V1 "check wallet balance
    // before touching stock" ordering) — an insufficient-balance TMR finalize throws here and
    // never reaches `produceFromConcentration`, so no `FeedStock` is fabricated for a batch that
    // was never actually paid for.
    //
    // RAKHAL-354: migrated off V1 `FinanceService.recordTransaction` (`INVENTORY_PURCHASE`) onto
    // a direct `JournalService.postJournal` call — debits Inventory (ledger code `1200`, the
    // asset `FeedStock` becomes), credits the resolved `FinancialAccount`. This is deliberately
    // NOT `ExpenseService.recordExpense`: a TMR batch becomes `FeedStock`, a real inventory
    // asset (mirrors `PurchaseService.createPurchase`'s own Inventory-debit treatment for a
    // Medicine/FeedItem/Equipment purchase), not a consumed expense — booking it as an expense
    // would double-count once real feed-consumption costing exists. RAKHAL-393 (closes RD-066):
    // `financialAccountId` now comes straight from the frontend's `AccountPicker` — the
    // `resolveFinancialAccountId` "oldest active account of that type" stopgap is deleted.
    // Always paid in full immediately, same as V1 (no partial-payment/Payable concept existed
    // for this route before, and none is added now).
    const INVENTORY_LEDGER_CODE = '1200';
    let financeResult: { journalTransactionId: string } | null = null;
    if (row.kind === 'FEED_MIXTURE' && deductions.unlinkedCostTk > 0) {
      await this.financialAccountService.assertAccountActive(
        farmId,
        financialAccountId!,
      );
      const account = await this.prisma.financialAccount.findFirstOrThrow({
        where: { id: financialAccountId, farmId },
        select: { ledgerAccountId: true },
      });
      const inventoryAccount = await this.ledgerAccountService.findByCode(
        farmId,
        INVENTORY_LEDGER_CODE,
      );
      if (!inventoryAccount) {
        throw new BadRequestException(
          'Inventory ledger account is not seeded for this farm',
        );
      }
      const posted = await this.journalService.postJournal({
        farmId,
        sourceType: 'FEED_MIXTURE_FINALIZE',
        sourceId: row.id,
        transactionDate: new Date(),
        description: `TMR finalize: ${row.name}`,
        idempotencyKey: `feed-mixture-finalize:${row.id}:${randomUUID()}`,
        createdById: userId,
        entries: [
          {
            ledgerAccountId: inventoryAccount.id,
            debit: deductions.unlinkedCostTk,
          },
          {
            ledgerAccountId: account.ledgerAccountId,
            credit: deductions.unlinkedCostTk,
          },
        ],
      });
      financeResult = { journalTransactionId: posted.id };
    }

    if (row.kind === 'FEED_MIXTURE') {
      stock = await this.prisma.$transaction(async (tx) => {
        await this.applyBatchDeductions(farmId, userId, tx, deductions);
        return this.feedStock.produceFromConcentration(
          farmId,
          userId,
          {
            concentrationId: row.id,
            version: 1,
            qtyKg: totalAsFedKg,
            costTk: correctedTotalCostTk,
            // RAKHAL-327: batch nutrient snapshot, same back-derivation math as
            // `buildIngredientNutrition` (a Concentrate Mixer's promoted-ingredient path) —
            // this is the recipe's on-paper composition, not a lab measurement, hence the
            // service-side `nutritionSource: REFERENCE` default.
            nutrition: this.buildStockNutritionSnapshot(totals, totalAsFedKg),
            kind: 'FEED_MIXTURE',
          },
          tx,
        );
      });
    }

    // Auto-checkpoint on first finalize (2026-08-13) — every produced TMR batch should have
    // at least one traceable version, even if the farmer never explicitly clicked "Save as
    // Template" first. No-op if a version already exists (explicit saves take priority).
    if (row.kind === 'FEED_MIXTURE') {
      const hasVersion = await this.prisma.feedConcentrationVersion.findFirst({
        where: { concentrationId: row.id },
        select: { id: true },
      });
      if (!hasVersion) {
        await this.saveAsVersion(farmId, userId, row.id);
      }
    }

    return {
      concentration_id: row.id,
      stock,
      ingredient: ingredientResult,
      finance: financeResult
        ? { journal_transaction_id: financeResult.journalTransactionId }
        : null,
    };
  }

  /**
   * Explicit-checkpoint versioning (2026-08-13, user request — "develop his existing ration
   * day by day... save it as template"), `FEED_MIXTURE` only: a Concentrate Mixer stays
   * live-sync-only, never versioned (see `FeedConcentration.versionNumber`'s doc comment).
   * Freezes the current ingredient lines + cost into a `FeedConcentrationVersion` row and
   * bumps `versionNumber` — day-to-day edits between checkpoints stay live-sync, only an
   * explicit save (or a first `finalize()`, see that method) creates a checkpoint.
   */
  async saveAsVersion(
    farmId: string,
    userId: string,
    id: string,
    name?: string,
  ) {
    const row = await this.getOrThrow(farmId, id);
    if (row.kind !== 'FEED_MIXTURE') {
      throw new BadRequestException(
        'Only a Total Mixed Ration can be versioned — a Concentrate Mixer stays live-sync',
      );
    }
    if (row.items.length === 0) {
      throw new BadRequestException(
        'Cannot version an empty concentration — add ingredients first',
      );
    }

    const [effById, nameById] = await Promise.all([
      this.effectiveMap(
        farmId,
        row.items.map((i) => i.ingredientId),
      ),
      this.ingredientNames(row.items.map((i) => i.ingredientId)),
    ]);
    const lines: FormulaLine[] = row.items.map((i) => ({
      ingredientId: i.ingredientId,
      amountKg: i.amountKg,
    }));
    const { totals } = computeTotals(lines, effById);

    const nextVersionNumber = row.versionNumber;
    const snapshotItems = row.items.map((i) => ({
      ingredientId: i.ingredientId,
      ingredientName: nameById.get(i.ingredientId) ?? i.ingredientId,
      amountKg: i.amountKg,
      pricePerKg: effById.get(i.ingredientId)?.pricePerKg ?? 0,
    }));

    const [version] = await this.prisma.$transaction([
      this.prisma.feedConcentrationVersion.create({
        data: {
          farmId,
          concentrationId: id,
          versionNumber: nextVersionNumber,
          name,
          snapshotItems,
          totalCostPerDay: totals.total_cost_tk,
          createdBy: userId,
        },
      }),
      this.prisma.feedConcentration.update({
        where: { id },
        data: { versionNumber: nextVersionNumber + 1 },
      }),
    ]);

    this.log.info('Feed concentration version saved', {
      farmId,
      concentrationId: id,
      versionNumber: version.versionNumber,
    });
    return {
      id: version.id,
      version_number: version.versionNumber,
      name: version.name,
      total_cost_per_day: version.totalCostPerDay,
      created_at: version.createdAt,
    };
  }

  async listVersions(farmId: string, id: string) {
    await this.getOrThrow(farmId, id);
    const rows = await this.prisma.feedConcentrationVersion.findMany({
      where: { farmId, concentrationId: id },
      orderBy: { versionNumber: 'desc' },
    });
    return rows.map((v) => ({
      id: v.id,
      version_number: v.versionNumber,
      name: v.name,
      items: v.snapshotItems,
      total_cost_per_day: v.totalCostPerDay,
      created_at: v.createdAt,
    }));
  }

  /** Scale a draft formula's amounts so total DM meets the requirement (§12.4). */
  async normalize(farmId: string, dto: NormalizeConcentrationDto) {
    await this.assertIngredients(dto.items.map((i) => i.ingredientId));
    const effById = await this.effectiveMap(
      farmId,
      dto.items.map((i) => i.ingredientId),
    );
    // RAKHAL-411: the farm's own tuned model, not the built-in defaults — otherwise a
    // farm that adjusted its settings would still be balanced against stock numbers here.
    const settings = await this.requirementSettings.resolve(farmId);
    const req = computeRequirements(
      {
        weightKg: dto.weightKg,
        milkTargetL: dto.milkTargetL,
        milkFatPct: dto.milkFatPct,
      },
      settings,
    );
    const lines: FormulaLine[] = dto.items.map((i) => ({
      ingredientId: i.ingredientId,
      amountKg: i.amountKg,
    }));
    const normalized = normalize(lines, req, effById);
    const comp = computeTotals(normalized, effById);
    return {
      requirements: this.reqShape(req),
      items: normalized.map((l) => ({
        ingredient_id: l.ingredientId,
        amount_kg: l.amountKg,
      })),
      totals: comp.totals,
      balance_score: balanceScore(comp.totals, req),
    };
  }

  // ---- internals ----------------------------------------------------------

  private async enrich(
    farmId: string,
    row: ConcentrationWithItems,
    detailed = false,
    finalizedIds?: Set<string>,
    /** Pre-resolved by the caller for a batch; omit and this row resolves its own. */
    requirement?: Requirements | null,
    /** Likewise for ingredient pricing and nutrition (RD-079) — the list path resolves the whole
     * page's ingredients once instead of two queries per row. Keyed by ingredient id, so one
     * shared map serves every row; single-row callers still resolve their own. */
    effByIdForBatch?: Map<string, EffectiveIngredient>,
  ) {
    const ids = row.items.map((i) => i.ingredientId);
    const effById = effByIdForBatch ?? (await this.effectiveMap(farmId, ids));
    const lines: FormulaLine[] = row.items.map((i) => ({
      ingredientId: i.ingredientId,
      amountKg: i.amountKg,
    }));
    const comp = computeTotals(lines, effById);

    // RAKHAL-411 (completed): the requirement now comes from the live cow record — her weight,
    // body condition, gestation days and 7-day milk average — rather than the target weight/milk
    // frozen into the ration when it was created. A saved ration and
    // `GET /feed/requirements?cattleId=` for the same animal therefore agree, which they did not
    // before. Callers pass it in pre-resolved so the list path resolves the whole page in one
    // batch instead of once per row.
    const req: Requirements | null =
      requirement !== undefined
        ? requirement
        : ((
            await this.feedRequirements.resolveForConcentrations(farmId, [row])
          ).get(row.id) ?? null);
    const balance = req ? balanceScore(comp.totals, req) : null;

    const base = {
      id: row.id,
      kind: row.kind,
      name: row.name,
      target_type: row.targetType,
      feed_group_id: row.feedGroupId,
      cattle_id: row.cattleId,
      duration_days: row.durationDays,
      target_weight_kg: row.targetWeightKg,
      target_milk_l: row.targetMilkL,
      totals: comp.totals,
      balance_score: balance,
      requirements: req ? this.reqShape(req) : null,
      is_finalized: finalizedIds?.has(row.id) ?? false,
      created_at: row.createdAt,
    };
    if (!detailed) return base;

    const ingNames = await this.ingredientNames(ids);
    // RAKHAL-422: batch link lives on the raw `FeedConcentrationItem` row, not on
    // `computeTotals`'s output — keyed by ingredientId (not index: `computeTotals` silently
    // skips a line whose ingredient has no resolvable nutrition, so the two arrays can differ in
    // length; last-write-wins is fine here since two lines sharing one ingredientId is already an
    // edge case the formula math itself doesn't disambiguate).
    const linkByIngredientId = new Map(
      row.items.map((i) => [
        i.ingredientId,
        { feedItemId: i.feedItemId, feedStockId: i.feedStockId },
      ]),
    );
    return {
      ...base,
      ingredients: comp.items.map((it) => ({
        ingredient_id: it.ingredientId,
        name: ingNames.get(it.ingredientId) ?? null,
        amount_kg: it.amount_kg,
        dm_kg: it.dm_kg,
        cp_kg: it.cp_kg,
        me_mj: it.me_mj,
        ndf_kg: it.ndf_kg,
        fat_kg: it.fat_kg,
        rdp_kg: it.rdp_kg,
        rup_kg: it.rup_kg,
        starch_kg: it.starch_kg,
        adf_kg: it.adf_kg,
        calcium_kg: it.calcium_kg,
        phosphorus_kg: it.phosphorus_kg,
        tdn_kg: it.tdn_kg,
        cost_tk: it.cost_tk,
        feed_item_id:
          linkByIngredientId.get(it.ingredientId)?.feedItemId ?? null,
        feed_stock_id:
          linkByIngredientId.get(it.ingredientId)?.feedStockId ?? null,
      })),
    };
  }

  /** Effective (override-merged) ingredient nutrition/price by id, farm-scoped. */
  private async effectiveMap(
    farmId: string,
    ingredientIds: string[],
  ): Promise<Map<string, EffectiveIngredient>> {
    const ids = [...new Set(ingredientIds)];
    // No `deletedAt` filter (RAKHAL-310): `ids` come from an existing
    // formula's saved line items, which must keep resolving nutrition/price
    // even if that ingredient was archived after the formula was built.
    const [ingredients, overrides] = await Promise.all([
      this.prisma.feedIngredient.findMany({ where: { id: { in: ids } } }),
      this.prisma.feedIngredientOverride.findMany({
        where: { farmId, ingredientId: { in: ids } },
      }),
    ]);
    const ovById = new Map(overrides.map((o) => [o.ingredientId, o]));
    return new Map(
      ingredients.map((ing) => [
        ing.id,
        resolveEffective(ing, ovById.get(ing.id) ?? null),
      ]),
    );
  }

  /** Back-derives per-DM/per-CP nutrient rates from a formula's computed totals onto the shape
   * `FeedIngredient` needs — shared by `finalize()` (first promotion / refresh-on-reFinalize) and
   * `refreshPromotedIngredientIfExists()` (live-sync on plain edit-save), so the two call sites
   * can never drift from each other. */
  private buildIngredientNutrition(
    name: string,
    totals: FormulaTotals,
    totalAsFedKg: number,
  ) {
    const pctOfDm = (kg: number) =>
      totals.dm_kg > 0 ? (kg / totals.dm_kg) * 100 : 0;
    const pctOfCp = (kg: number) =>
      totals.cp_kg > 0 ? (kg / totals.cp_kg) * 100 : 0;
    return {
      nameEn: name,
      feedClass: 'CONCENTRATE' as const,
      feedSubType: 'COMPOUND_PELLET' as const,
      dmPct: (totalAsFedKg > 0 ? totals.dm_kg / totalAsFedKg : 0) * 100,
      cpPct: pctOfDm(totals.cp_kg),
      meMjPerKgDm: totals.dm_kg > 0 ? totals.me_mj / totals.dm_kg : 0,
      fatPct: pctOfDm(totals.fat_kg),
      ndfPct: pctOfDm(totals.ndf_kg),
      rdpPct: pctOfCp(totals.rdp_kg),
      rupPct: pctOfCp(totals.rup_kg),
      starchPct: pctOfDm(totals.starch_kg),
      adfPct: pctOfDm(totals.adf_kg),
      calciumPct: pctOfDm(totals.calcium_kg),
      phosphorusPct: pctOfDm(totals.phosphorus_kg),
      tdnPct: pctOfDm(totals.tdn_kg),
      currentPricePerKg: totals.total_cost_tk / totalAsFedKg,
    };
  }

  /** RAKHAL-327: the same DM/CP back-derivation `buildIngredientNutrition` uses, trimmed to just
   * the nutrient fields `FeedStock`'s batch snapshot needs (no name/class/price). Kept as its own
   * method rather than reusing `buildIngredientNutrition`'s output directly so the two call sites
   * (promoted-ingredient vs. produced-stock) can diverge later without coupling. */
  private buildStockNutritionSnapshot(
    totals: FormulaTotals,
    totalAsFedKg: number,
  ): StockNutritionSnapshot {
    const pctOfDm = (kg: number) =>
      totals.dm_kg > 0 ? (kg / totals.dm_kg) * 100 : 0;
    const pctOfCp = (kg: number) =>
      totals.cp_kg > 0 ? (kg / totals.cp_kg) * 100 : 0;
    return {
      dmPct: (totalAsFedKg > 0 ? totals.dm_kg / totalAsFedKg : 0) * 100,
      cpPct: pctOfDm(totals.cp_kg),
      meMjPerKgDm: totals.dm_kg > 0 ? totals.me_mj / totals.dm_kg : 0,
      fatPct: pctOfDm(totals.fat_kg),
      ndfPct: pctOfDm(totals.ndf_kg),
      rdpPct: pctOfCp(totals.rdp_kg),
      rupPct: pctOfCp(totals.rup_kg),
      starchPct: pctOfDm(totals.starch_kg),
      adfPct: pctOfDm(totals.adf_kg),
      calciumPct: pctOfDm(totals.calcium_kg),
      phosphorusPct: pctOfDm(totals.phosphorus_kg),
      tdnPct: pctOfDm(totals.tdn_kg),
    };
  }

  private mapIngredient(ing: FeedIngredient) {
    return {
      id: ing.id,
      name_en: ing.nameEn,
      is_custom: true,
      is_latest_version: ing.isLatestVersion,
      source_concentration_id: ing.sourceConcentrationId,
      source_concentration_version: ing.sourceConcentrationVersion,
      effective_price_per_kg: ing.currentPricePerKg,
      nutrition: {
        dm_pct: ing.dmPct,
        cp_pct: ing.cpPct,
        me_mj_per_kg_dm: ing.meMjPerKgDm,
        fat_pct: ing.fatPct,
        ndf_pct: ing.ndfPct,
        rdp_pct: ing.rdpPct,
        rup_pct: ing.rupPct,
        starch_pct: ing.starchPct,
        adf_pct: ing.adfPct,
        calcium_pct: ing.calciumPct,
        phosphorus_pct: ing.phosphorusPct,
        tdn_pct: ing.tdnPct,
      },
    };
  }

  /** Live-sync half of the 2026-07-18 rework (see `update()`'s doc comment) — if this template has
   * already been finalized at least once (a `FeedIngredient` with matching `sourceConcentrationId`
   * exists), refresh its nutrition/price to match the just-saved formula. **Never creates one** —
   * a template that hasn't been finalized yet stays un-promoted until the farmer deliberately
   * clicks Finalize; a plain edit must not silently start affecting other formulas' ingredient
   * pickers or any TMR. No-ops (leaves the promoted ingredient as it was) if the edit left the
   * formula with no measurable dry matter — same guard `finalize()` itself uses — rather than
   * writing nonsensical zeroed-out nutrition onto a row that's still actively referenced. */
  private async refreshPromotedIngredientIfExists(
    farmId: string,
    row: ConcentrationWithItems,
  ) {
    // No `deletedAt` filter (RAKHAL-310) — mirrors `finalize()`'s own upsert,
    // which resurrects (`deletedAt: null`) a previously-archived promoted
    // ingredient on refinalize, so the lookup here must find it either way.
    const promoted = await this.prisma.feedIngredient.findFirst({
      where: { sourceConcentrationId: row.id },
    });
    if (!promoted) return;

    const effById = await this.effectiveMap(
      farmId,
      row.items.map((i) => i.ingredientId),
    );
    const lines: FormulaLine[] = row.items.map((i) => ({
      ingredientId: i.ingredientId,
      amountKg: i.amountKg,
    }));
    const { totals } = computeTotals(lines, effById);
    const totalAsFedKg = row.items.reduce((sum, i) => sum + i.amountKg, 0);
    if (totalAsFedKg <= 0 || totals.dm_kg <= 0) return;

    const nutrition = this.buildIngredientNutrition(
      row.name,
      totals,
      totalAsFedKg,
    );
    await this.prisma.feedIngredient.update({
      where: { id: promoted.id },
      data: nutrition,
    });
  }

  // No `deletedAt` filter (RAKHAL-310): resolves display names for an
  // existing formula's line items, which must still show a name even for an
  // ingredient archived after the formula was built.
  private async ingredientNames(ids: string[]) {
    const rows = await this.prisma.feedIngredient.findMany({
      where: { id: { in: ids } },
      select: { id: true, nameEn: true },
    });
    return new Map(rows.map((r) => [r.id, r.nameEn]));
  }

  private async assertIngredients(ingredientIds: string[]) {
    const ids = [...new Set(ingredientIds)];
    const count = await this.prisma.feedIngredient.count({
      where: { id: { in: ids }, deletedAt: null },
    });
    if (count !== ids.length) {
      throw new BadRequestException('One or more ingredients are invalid');
    }
  }

  /** RAKHAL-425: a Total Mixed Ration must build on at least one finalized Concentrate Mixer —
   * one line whose ingredient was promoted from a concentrate (`FeedIngredient.sourceConcentrationId
   * != null`), not purely catalogue ingredients. A concentrate only becomes referenceable once
   * finalized at least once (promotion happens in `finalize()`), which is why the error names that
   * path explicitly rather than just saying "invalid ingredient". */
  private async assertHasConcentrateDerivedLine(
    items: { ingredientId: string }[],
  ) {
    const ids = [...new Set(items.map((i) => i.ingredientId))];
    const count = await this.prisma.feedIngredient.count({
      where: { id: { in: ids }, sourceConcentrationId: { not: null } },
    });
    if (count === 0) {
      throw new BadRequestException(
        'A Total Mixed Ration requires at least one line using a finalized Concentrate Mixer — build and finalize a Concentrate Mixer first, then reference its promoted ingredient here',
      );
    }
  }

  /** RAKHAL-422: validates each line's optional batch link — at most one of
   * `feedItemId`/`feedStockId`, the referenced batch is farm-owned and not soft-deleted, and its
   * own ingredient matches the line's `ingredientId` (a line cannot claim to be maize while
   * consuming bran). Batched (not per-line) to avoid N+1 on a multi-line recipe. */
  private async assertBatchLinks(
    farmId: string,
    items: {
      ingredientId: string;
      feedItemId?: string;
      feedStockId?: string;
    }[],
  ) {
    for (const item of items) {
      if (item.feedItemId && item.feedStockId) {
        throw new BadRequestException(
          `Line for ingredient ${item.ingredientId} cannot link both a purchased batch and a prepared batch — pick one`,
        );
      }
    }

    const feedItemIds = [
      ...new Set(items.filter((i) => i.feedItemId).map((i) => i.feedItemId!)),
    ];
    const feedStockIds = [
      ...new Set(items.filter((i) => i.feedStockId).map((i) => i.feedStockId!)),
    ];
    if (feedItemIds.length === 0 && feedStockIds.length === 0) return;

    const [feedItems, feedStocks]: [
      { id: string; ingredientId: string | null }[],
      { id: string; sourceConcentrationId: string }[],
    ] = await Promise.all([
      feedItemIds.length
        ? this.prisma.feedItem.findMany({
            where: { id: { in: feedItemIds }, farmId, deletedAt: null },
            select: { id: true, ingredientId: true },
          })
        : [],
      feedStockIds.length
        ? this.prisma.feedStock.findMany({
            where: { id: { in: feedStockIds }, farmId, deletedAt: null },
            select: { id: true, sourceConcentrationId: true },
          })
        : [],
    ]);
    const feedItemById = new Map(feedItems.map((f) => [f.id, f]));
    const stockById = new Map(feedStocks.map((s) => [s.id, s]));

    // A FeedStock has no direct ingredientId — the batch's composition is the concentration's
    // own promoted FeedIngredient (upserted by sourceConcentrationId, see `finalize()`).
    const sourceConcIds = [
      ...new Set(feedStocks.map((s) => s.sourceConcentrationId)),
    ];
    const promotedIngredients = sourceConcIds.length
      ? await this.prisma.feedIngredient.findMany({
          where: { sourceConcentrationId: { in: sourceConcIds } },
          select: { id: true, sourceConcentrationId: true },
        })
      : [];
    const ingredientIdBySourceConc = new Map(
      promotedIngredients.map((i) => [i.sourceConcentrationId as string, i.id]),
    );

    for (const item of items) {
      if (item.feedItemId) {
        const linked = feedItemById.get(item.feedItemId);
        if (!linked) {
          throw new BadRequestException(
            `Linked feed item ${item.feedItemId} not found`,
          );
        }
        if (linked.ingredientId !== item.ingredientId) {
          throw new BadRequestException(
            `Linked feed item ${item.feedItemId} does not match this line's ingredient`,
          );
        }
      }
      if (item.feedStockId) {
        const linked = stockById.get(item.feedStockId);
        if (!linked) {
          throw new BadRequestException(
            `Linked feed stock ${item.feedStockId} not found`,
          );
        }
        const promotedIngredientId = ingredientIdBySourceConc.get(
          linked.sourceConcentrationId,
        );
        if (promotedIngredientId !== item.ingredientId) {
          throw new BadRequestException(
            `Linked feed stock ${item.feedStockId} does not match this line's ingredient`,
          );
        }
      }
    }
  }

  /**
   * RAKHAL-423/424: resolves what a finalize must deduct and how much it actually costs, given
   * each line's optional batch link (already validated by `assertBatchLinks` at create/update
   * time — this re-checks sufficiency against current stock, which can only be known now).
   * Applies to both kinds identically — a Concentrate Mixer with linked lines deducts them
   * exactly as a TMR does; there is no kind-specific branch here.
   *
   * 1. Sums each batch's total draw across every line that references it (two lines may share
   *    one batch).
   * 2. Self-consumption guard: a `feedStockId` produced by this same concentration is rejected —
   *    a recipe must not eat its own output.
   * 3. Validates sufficiency per batch — `FeedStockService.assertSufficientStock` (FeedStock) and
   *    `FeedDistributionService.computeFeedItemUsage` (FeedItem, which also resolves its real
   *    per-kg price) — before anything is written, same fail-fast-before-transaction convention
   *    `feed-distribution.service.ts`'s own `computeFeedItemUsage` doc comment describes.
   * 4. Splits the recipe's real cost: a linked line prices from the batch's own real cost (what
   *    was actually consumed), an unlinked line keeps the catalogue price — this is `producedCostTk`
   *    accuracy for RAKHAL-423, and the RAKHAL-424 purchase/transfer split for the caller to journal.
   */
  private async resolveBatchDeductions(
    farmId: string,
    concentrationId: string,
    items: {
      ingredientId: string;
      amountKg: number;
      feedItemId: string | null;
      feedStockId: string | null;
    }[],
    effById: Map<string, EffectiveIngredient>,
  ): Promise<{
    linkedCostTk: number;
    unlinkedCostTk: number;
    feedItemDeductions: { feedItemId: string; newStock: number }[];
    feedStockDeductions: { feedStockId: string; quantity: number }[];
  }> {
    const feedItemQty = new Map<string, number>();
    const feedStockQty = new Map<string, number>();
    for (const item of items) {
      if (item.feedItemId) {
        feedItemQty.set(
          item.feedItemId,
          (feedItemQty.get(item.feedItemId) ?? 0) + item.amountKg,
        );
      } else if (item.feedStockId) {
        feedStockQty.set(
          item.feedStockId,
          (feedStockQty.get(item.feedStockId) ?? 0) + item.amountKg,
        );
      }
    }

    const feedItemPricePerKg = new Map<string, number>();
    const feedItemDeductions: { feedItemId: string; newStock: number }[] = [];
    for (const [feedItemId, qty] of feedItemQty) {
      const usage = await this.feedDistribution.computeFeedItemUsage(
        farmId,
        feedItemId,
        qty,
      );
      feedItemPricePerKg.set(feedItemId, usage.pricePerKg);
      feedItemDeductions.push({ feedItemId, newStock: usage.newStock });
    }

    const feedStockPricePerKg = new Map<string, number>();
    const feedStockDeductions: { feedStockId: string; quantity: number }[] = [];
    if (feedStockQty.size > 0) {
      const stocks = await this.prisma.feedStock.findMany({
        where: { id: { in: [...feedStockQty.keys()] } },
        select: {
          id: true,
          sourceConcentrationId: true,
          producedCostTk: true,
          producedQtyKg: true,
        },
      });
      for (const s of stocks) {
        if (s.sourceConcentrationId === concentrationId) {
          throw new BadRequestException(
            `Line links FeedStock ${s.id}, which this same concentration itself produced — a recipe cannot consume its own output`,
          );
        }
        feedStockPricePerKg.set(
          s.id,
          s.producedQtyKg > 0 ? s.producedCostTk / s.producedQtyKg : 0,
        );
      }
      await this.feedStock.assertSufficientStock(
        farmId,
        [...feedStockQty.entries()].map(([feedStockId, quantity]) => ({
          stockId: feedStockId,
          quantity,
        })),
      );
      for (const [feedStockId, quantity] of feedStockQty) {
        feedStockDeductions.push({ feedStockId, quantity });
      }
    }

    let linkedCostTk = 0;
    let unlinkedCostTk = 0;
    for (const item of items) {
      if (item.feedItemId) {
        linkedCostTk +=
          item.amountKg * (feedItemPricePerKg.get(item.feedItemId) ?? 0);
      } else if (item.feedStockId) {
        linkedCostTk +=
          item.amountKg * (feedStockPricePerKg.get(item.feedStockId) ?? 0);
      } else {
        const eff = effById.get(item.ingredientId);
        unlinkedCostTk += item.amountKg * (eff?.pricePerKg ?? 0);
      }
    }

    return {
      linkedCostTk: round2(linkedCostTk),
      unlinkedCostTk: round2(unlinkedCostTk),
      feedItemDeductions,
      feedStockDeductions,
    };
  }

  /** Applies the deductions `resolveBatchDeductions` resolved, inside the caller's transaction
   * so a decrement and the `FeedStock` it produces commit or roll back together. */
  private async applyBatchDeductions(
    farmId: string,
    userId: string,
    tx: Prisma.TransactionClient,
    deductions: {
      feedItemDeductions: { feedItemId: string; newStock: number }[];
      feedStockDeductions: { feedStockId: string; quantity: number }[];
    },
  ) {
    for (const d of deductions.feedItemDeductions) {
      await tx.feedItem.update({
        where: { id: d.feedItemId },
        data: { currentStock: d.newStock },
      });
    }
    for (const d of deductions.feedStockDeductions) {
      await this.feedStock.decrementForDistribution(
        farmId,
        userId,
        { stockId: d.feedStockId, quantity: d.quantity },
        tx,
      );
    }
  }

  private async validateTargets(
    farmId: string,
    feedGroupId?: string,
    cattleId?: string,
  ) {
    if (feedGroupId) {
      const group = await this.prisma.feedGroup.findFirst({
        where: { id: feedGroupId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!group)
        throw new BadRequestException('Feed group must belong to the farm');
    }
    if (cattleId) {
      const cattle = await this.prisma.cattle.findFirst({
        where: { id: cattleId, ...activeHerd(farmId) },
        select: { id: true },
      });
      if (!cattle)
        throw new BadRequestException('Cattle must belong to the farm');
    }
  }

  private async getOrThrow(
    farmId: string,
    id: string,
  ): Promise<ConcentrationWithItems> {
    const row = await this.prisma.feedConcentration.findFirst({
      where: { id, farmId, deletedAt: null },
      include: { items: true },
    });
    if (!row) throw new NotFoundException('Concentration template not found');
    return row;
  }

  private reqShape(req: Requirements) {
    return {
      dm_kg: req.dmKg,
      cp_kg: req.cpKg,
      me_mj: req.meMj,
      ndf_kg: req.ndfKg,
      fat_kg: req.fatKg,
    };
  }
}
