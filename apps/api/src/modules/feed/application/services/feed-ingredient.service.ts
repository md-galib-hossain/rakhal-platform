import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeedIngredient, FeedIngredientOverride, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { resolveEffective } from '../../domain/ingredient-resolver';
import { SetFeedOverrideDto } from '../../presentation/dto/set-feed-override.dto';
import { CreateCustomIngredientDto } from '../../presentation/dto/create-custom-ingredient.dto';
import { UpdateCustomIngredientDto } from '../../presentation/dto/update-custom-ingredient.dto';
import { CreateCatalogueIngredientDto } from '../../presentation/dto/create-catalogue-ingredient.dto';
import { UpdateCatalogueIngredientDto } from '../../presentation/dto/update-catalogue-ingredient.dto';
import { ListIngredientsQueryDto } from '../../presentation/dto/list-ingredients-query.dto';

/**
 * Feed ingredient catalogue + per-farm overrides (PRD §12.1 / §4.3, RAKHAL-080).
 * The catalogue is the seeded global `FeedIngredient` table (`farmId: null`);
 * farms layer price/nutrition overrides on top. The merged, effective view is
 * resolved by the pure `resolveEffective` domain helper.
 *
 * Farms can also **quick-add their own ingredient** (`createCustom`, no Figma
 * frame — user request 2026-07-17) when one isn't in the Admin catalogue: a
 * `FeedIngredient` row scoped to that farm (`farmId` set, invisible to every
 * other farm) with no known nutrition breakdown — see that model's Prisma doc
 * comment for the `dmPct: 100`/zeroed-nutrient rationale.
 *
 * **Admin catalogue authoring** (RAKHAL-233 / PRD ADM-13/14, user request
 * 2026-07-17 "later from admin we can add ingredients and modify nutrition
 * profiles"): `createCatalogueIngredient`/`updateCatalogueIngredient`/
 * `setCatalogueIngredientActive`/`listCatalogueForAdmin` are called only from
 * `AdminFeedIngredientController` (`PlatformAdminGuard`-gated, `admin-api`) —
 * they operate on `farmId: null` rows exclusively and reject any farm-owned
 * (custom/promoted) row. The schema already supported this (`farmId` nullable,
 * `isSystemDefault` existed) — no migration was needed, only these new methods.
 */
@Injectable()
export class FeedIngredientService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(FeedIngredientService.name);
  }

  /** Merged ingredient list (Admin catalogue + this farm's own quick-added/promoted rows, × this
   * farm's overrides). `isLatestVersion: true` excludes a superseded promoted-concentration version
   * (see `FeedIngredient`'s doc comment) — every other row defaults `true` so this is a no-op filter
   * for the catalogue and plain quick-add ingredients. */
  async listMerged(farmId: string, includeArchived = false) {
    const [ingredients, overrides] = await Promise.all([
      this.prisma.feedIngredient.findMany({
        where: {
          ...(includeArchived ? {} : { isActive: true }),
          isLatestVersion: true,
          OR: [{ farmId: null }, { farmId }],
        },
        orderBy: [{ feedClass: 'asc' }, { nameEn: 'asc' }],
      }),
      this.prisma.feedIngredientOverride.findMany({ where: { farmId } }),
    ]);
    const overrideByIngredient = new Map(
      overrides.map((o) => [o.ingredientId, o]),
    );

    return ingredients.map((ing) =>
      this.toMerged(ing, overrideByIngredient.get(ing.id) ?? null),
    );
  }

  /** Cursor-paginated + filterable ingredients list for the Ingredients management table
   * (search / `feedClass` / catalogue-price range on top of `listMerged`'s farm+archive scoping) —
   * a separate method from `listMerged` on purpose: pickers (`IngredientPicker`, create-feed dialog,
   * concentration detail sheet) need the *full* unpaginated catalogue for selection, so that plain
   * array endpoint stays untouched. Price-range filters `currentPricePerKg` (the catalogue/admin
   * price) rather than the per-farm resolved `effective_price_per_kg`, since the latter is computed
   * in JS after merging overrides and can't be pushed into the Prisma `where`. */
  async listPaged(
    farmId: string,
    query: ListIngredientsQueryDto,
  ): Promise<CursorPage<ReturnType<FeedIngredientService['toMerged']>>> {
    const where: Prisma.FeedIngredientWhereInput = {
      ...(query.includeArchived ? {} : { isActive: true }),
      isLatestVersion: true,
      OR: [{ farmId: null }, { farmId }],
      ...(query.feedClass ? { feedClass: query.feedClass } : {}),
      ...(query.priceMin != null || query.priceMax != null
        ? {
            currentPricePerKg: {
              ...(query.priceMin != null ? { gte: query.priceMin } : {}),
              ...(query.priceMax != null ? { lte: query.priceMax } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            AND: [
              {
                OR: [
                  { nameEn: { contains: query.search, mode: 'insensitive' } },
                  { nameBn: { contains: query.search, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.feedIngredient.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });

    const page = toCursorPage(rows, query);
    const overrides = page.items.length
      ? await this.prisma.feedIngredientOverride.findMany({
          where: {
            farmId,
            ingredientId: { in: page.items.map((ing) => ing.id) },
          },
        })
      : [];
    const overrideByIngredient = new Map(
      overrides.map((o) => [o.ingredientId, o]),
    );

    return {
      items: page.items.map((ing) =>
        this.toMerged(ing, overrideByIngredient.get(ing.id) ?? null),
      ),
      meta: page.meta,
    };
  }

  /** Create this farm's own ingredient — name/category/cost only (quick-add, no nutrition
   * breakdown, `dmPct` defaults 100 / everything else 0) or a full 12-nutrient profile when the
   * farm supplies one (see `CreateCustomIngredientDto`'s doc comment). */
  async createCustom(
    farmId: string,
    _userId: string,
    dto: CreateCustomIngredientDto,
  ) {
    const created = await this.prisma.feedIngredient.create({
      data: {
        farmId,
        nameEn: dto.name,
        // generic feed-class tag; `nutrientGroup` is the real display classifier
        feedClass: 'ADDITIVE',
        feedSubType: 'SUPPLEMENT',
        nutrientGroup: dto.nutrientGroup,
        dmPct: dto.dmPct ?? 100,
        cpPct: dto.cpPct ?? 0,
        meMjPerKgDm: dto.meMjPerKgDm ?? 0,
        fatPct: dto.fatPct ?? 0,
        ndfPct: dto.ndfPct ?? 0,
        rdpPct: dto.rdpPct ?? 0,
        rupPct: dto.rupPct ?? 0,
        starchPct: dto.starchPct ?? 0,
        adfPct: dto.adfPct ?? 0,
        calciumPct: dto.calciumPct ?? 0,
        phosphorusPct: dto.phosphorusPct ?? 0,
        tdnPct: dto.tdnPct ?? 0,
        currentPricePerKg: dto.pricePerKg,
        isSystemDefault: false,
        isAvailableBd: true,
      },
    });
    this.log.info('Custom feed ingredient created', {
      farmId,
      id: created.id,
    });
    return this.toMerged(created, null);
  }

  /** Partial update of this farm's own quick-added ingredient (name/price/nutrition). Rejects a
   * catalogue row (`farmId: null`) or another farm's row — a farm can only edit what it owns; the
   * global catalogue is Admin-managed and other farms' custom rows are never visible to this farm
   * anyway (`listMerged`'s `OR: [{ farmId: null }, { farmId }]` scoping). */
  async updateCustomIngredient(
    farmId: string,
    id: string,
    dto: UpdateCustomIngredientDto,
  ) {
    const existing = await this.assertOwnedCustomIngredient(farmId, id);
    const priceChanged =
      dto.pricePerKg != null && dto.pricePerKg !== existing.currentPricePerKg;
    const updated = await this.prisma.feedIngredient.update({
      where: { id },
      data: {
        nameEn: dto.name,
        nutrientGroup: dto.nutrientGroup,
        currentPricePerKg: dto.pricePerKg,
        dmPct: dto.dmPct,
        cpPct: dto.cpPct,
        meMjPerKgDm: dto.meMjPerKgDm,
        fatPct: dto.fatPct,
        ndfPct: dto.ndfPct,
        rdpPct: dto.rdpPct,
        rupPct: dto.rupPct,
        starchPct: dto.starchPct,
        adfPct: dto.adfPct,
        calciumPct: dto.calciumPct,
        phosphorusPct: dto.phosphorusPct,
        tdnPct: dto.tdnPct,
        ...(priceChanged ? { priceUpdatedAt: new Date() } : {}),
      },
    });
    this.log.info('Custom feed ingredient updated', { farmId, id });
    return this.toMerged(updated, null);
  }

  /** Archive this farm's own quick-added ingredient (soft-delete, matches every other module's
   * convention). Blocked if the ingredient is still used by an active concentration (Concentrate
   * Mixer or TMR) — the farm must remove it from those formulas first — or if it's a row promoted
   * from a finalized concentration (that link is owned by `FeedConcentrationService.finalize`, not
   * this endpoint). */
  async deactivateCustomIngredient(farmId: string, id: string) {
    await this.assertOwnedCustomIngredient(farmId, id);
    const referencedBy = await this.prisma.feedConcentrationItem.findFirst({
      where: { ingredientId: id, concentration: { isActive: true } },
      select: { id: true },
    });
    if (referencedBy) {
      throw new ConflictException(
        'Ingredient is used by an active concentration — remove it from that formula first',
      );
    }
    const updated = await this.prisma.feedIngredient.update({
      where: { id },
      data: { isActive: false },
    });
    this.log.info('Custom feed ingredient archived', { farmId, id });
    return this.toMerged(updated, null);
  }

  private async assertOwnedCustomIngredient(farmId: string, id: string) {
    const existing = await this.prisma.feedIngredient.findFirst({
      where: { id, farmId },
    });
    if (!existing) {
      throw new NotFoundException('Ingredient not found');
    }
    if (existing.sourceConcentrationId) {
      throw new BadRequestException(
        'This ingredient was promoted from a Concentrate Mixer — edit the source concentration instead',
      );
    }
    return existing;
  }

  /** Upsert this farm's override for an ingredient. */
  async setOverride(
    farmId: string,
    userId: string,
    ingredientId: string,
    dto: SetFeedOverrideDto,
  ) {
    await this.assertIngredientExists(ingredientId);
    const data = {
      customPricePerKg: dto.customPricePerKg ?? null,
      customDmPct: dto.customDmPct ?? null,
      customCpPct: dto.customCpPct ?? null,
      customMeMjPerKgDm: dto.customMeMjPerKgDm ?? null,
      customFatPct: dto.customFatPct ?? null,
      customNdfPct: dto.customNdfPct ?? null,
      customRdpPct: dto.customRdpPct ?? null,
      customRupPct: dto.customRupPct ?? null,
      customStarchPct: dto.customStarchPct ?? null,
      customAdfPct: dto.customAdfPct ?? null,
      customCalciumPct: dto.customCalciumPct ?? null,
      customPhosphorusPct: dto.customPhosphorusPct ?? null,
      customTdnPct: dto.customTdnPct ?? null,
      notes: dto.notes ?? null,
    };
    const override = await this.prisma.feedIngredientOverride.upsert({
      where: { farmId_ingredientId: { farmId, ingredientId } },
      update: data,
      create: { farmId, ingredientId, createdBy: userId, ...data },
    });
    this.log.info('Feed ingredient override set', { farmId, ingredientId });
    return override;
  }

  /** Reset an ingredient to Rakhal Admin defaults (remove the farm override). */
  async resetOverride(farmId: string, ingredientId: string) {
    await this.prisma.feedIngredientOverride.deleteMany({
      where: { farmId, ingredientId },
    });
    this.log.info('Feed ingredient override reset', { farmId, ingredientId });
    return { ingredient_id: ingredientId, price_source: 'rakhal_market' };
  }

  // ---- Admin catalogue authoring (RAKHAL-233 / ADM-13/14) -----------------

  /** Every catalogue row (including inactive/archived) for the admin ingredient-master list —
   * unlike `listMerged`, this is farm-agnostic and shows the full history, not one farm's merged view. */
  async listCatalogueForAdmin() {
    const rows = await this.prisma.feedIngredient.findMany({
      where: { farmId: null },
      orderBy: [{ feedClass: 'asc' }, { nameEn: 'asc' }],
    });
    return rows.map((ing) => this.toMerged(ing, null));
  }

  /** Create a new global catalogue ingredient (`farmId: null`, `isSystemDefault: true`). Unlike the
   * farm quick-add, DM/CP/ME and price are required — an admin-authored row should carry real data. */
  async createCatalogueIngredient(dto: CreateCatalogueIngredientDto) {
    const created = await this.prisma.feedIngredient.create({
      data: {
        farmId: null,
        nameEn: dto.nameEn,
        nameBn: dto.nameBn,
        feedClass: dto.feedClass,
        feedSubType: dto.feedSubType,
        dmPct: dto.dmPct,
        cpPct: dto.cpPct,
        meMjPerKgDm: dto.meMjPerKgDm,
        fatPct: dto.fatPct ?? 0,
        ndfPct: dto.ndfPct ?? 0,
        rdpPct: dto.rdpPct ?? 0,
        rupPct: dto.rupPct ?? 0,
        starchPct: dto.starchPct ?? 0,
        adfPct: dto.adfPct ?? 0,
        calciumPct: dto.calciumPct ?? 0,
        phosphorusPct: dto.phosphorusPct ?? 0,
        tdnPct: dto.tdnPct ?? 0,
        currentPricePerKg: dto.currentPricePerKg,
        priceUpdatedAt: new Date(),
        nutritionSourceNote: dto.nutritionSourceNote,
        nutritionSource: dto.nutritionSource,
        sourceRef: dto.sourceRef,
        isAvailableBd: dto.isAvailableBd ?? true,
        isSystemDefault: true,
      },
    });
    this.log.info('Catalogue feed ingredient created (admin)', {
      id: created.id,
    });
    return this.toMerged(created, null);
  }

  /** Partial update of an existing catalogue row's nutrition/price/category/name. Rejects a
   * farm-owned row (quick-add or promoted) — those are managed by the farm, not the admin panel. A
   * `currentPricePerKg` change bumps `priceUpdatedAt`; every formula computation reads this row
   * live, so farms see the new price immediately (ADM-14 — no separate "refresh" step needed). */
  async updateCatalogueIngredient(
    id: string,
    dto: UpdateCatalogueIngredientDto,
  ) {
    const existing = await this.prisma.feedIngredient.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Ingredient not found');
    if (existing.farmId != null) {
      throw new BadRequestException(
        'Not a catalogue ingredient — farm-owned rows are managed by the farm, not the admin panel',
      );
    }
    const priceChanged =
      dto.currentPricePerKg != null &&
      dto.currentPricePerKg !== existing.currentPricePerKg;

    const updated = await this.prisma.feedIngredient.update({
      where: { id },
      data: {
        nameEn: dto.nameEn,
        nameBn: dto.nameBn,
        feedClass: dto.feedClass,
        feedSubType: dto.feedSubType,
        dmPct: dto.dmPct,
        cpPct: dto.cpPct,
        meMjPerKgDm: dto.meMjPerKgDm,
        fatPct: dto.fatPct,
        ndfPct: dto.ndfPct,
        rdpPct: dto.rdpPct,
        rupPct: dto.rupPct,
        starchPct: dto.starchPct,
        adfPct: dto.adfPct,
        calciumPct: dto.calciumPct,
        phosphorusPct: dto.phosphorusPct,
        tdnPct: dto.tdnPct,
        currentPricePerKg: dto.currentPricePerKg,
        nutritionSourceNote: dto.nutritionSourceNote,
        nutritionSource: dto.nutritionSource,
        sourceRef: dto.sourceRef,
        isAvailableBd: dto.isAvailableBd,
        ...(priceChanged ? { priceUpdatedAt: new Date() } : {}),
      },
    });
    this.log.info('Catalogue feed ingredient updated (admin)', {
      id,
      priceChanged,
    });
    return this.toMerged(updated, null);
  }

  /** Archive/restore a catalogue row (soft-delete, matches every other module's convention — never
   * a hard delete, so historical formulas that used it keep resolving). */
  async setCatalogueIngredientActive(id: string, isActive: boolean) {
    const existing = await this.prisma.feedIngredient.findFirst({
      where: { id, farmId: null },
    });
    if (!existing)
      throw new NotFoundException('Catalogue ingredient not found');
    const updated = await this.prisma.feedIngredient.update({
      where: { id },
      data: { isActive },
    });
    this.log.info(
      isActive
        ? 'Catalogue feed ingredient restored (admin)'
        : 'Catalogue feed ingredient archived (admin)',
      { id },
    );
    return this.toMerged(updated, null);
  }

  private toMerged(
    ing: FeedIngredient,
    override: FeedIngredientOverride | null,
  ) {
    const eff = resolveEffective(ing, override);
    return {
      id: ing.id,
      name_en: ing.nameEn,
      name_bn: ing.nameBn,
      feed_class: ing.feedClass,
      feed_sub_type: ing.feedSubType,
      nutrient_group: ing.nutrientGroup,
      is_custom: ing.farmId != null,
      nutrition_source: ing.nutritionSourceNote,
      nutrition_source_type: eff.nutritionSource,
      source_ref: ing.sourceRef,
      rakhal_price_per_kg: ing.currentPricePerKg,
      price_updated_at: ing.priceUpdatedAt,
      effective_price_per_kg: eff.pricePerKg,
      price_source: eff.priceSource,
      has_nutrition_override: eff.hasNutritionOverride,
      is_available_bd: ing.isAvailableBd,
      nutrition: {
        dm_pct: eff.dmPct,
        cp_pct: eff.cpPct,
        me_mj_per_kg_dm: eff.meMjPerKgDm,
        fat_pct: eff.fatPct,
        ndf_pct: eff.ndfPct,
        rdp_pct: eff.rdpPct, // % of CP, not % of DM
        rup_pct: eff.rupPct, // % of CP, not % of DM
        starch_pct: eff.starchPct,
        adf_pct: eff.adfPct,
        calcium_pct: eff.calciumPct,
        phosphorus_pct: eff.phosphorusPct,
        tdn_pct: eff.tdnPct,
      },
      override_notes: override?.notes ?? null,
    };
  }

  private async assertIngredientExists(ingredientId: string) {
    const ing = await this.prisma.feedIngredient.findUnique({
      where: { id: ingredientId },
      select: { id: true },
    });
    if (!ing) {
      throw new BadRequestException('Ingredient not found');
    }
  }
}
