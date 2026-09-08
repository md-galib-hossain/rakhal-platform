import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { SubscriptionFeatureGuard } from 'src/modules/subscription/presentation/guards/subscription-feature.guard';
import { RequireFeature } from 'src/modules/subscription/presentation/decorators/require-feature.decorator';
import { FeedConcentrationService } from '../../application/services/feed-concentration.service';
import { FeedGroupAssignService } from '../../application/services/feed-group-assign.service';
import { FeedIngredientService } from '../../application/services/feed-ingredient.service';
import { FeedRequirementsService } from '../../application/services/feed-requirements.service';
import { RequirementSettingsService } from '../../application/services/requirement-settings.service';
import { FeedDistributionService } from '../../application/services/feed-distribution.service';
import { FeedStockService } from '../../application/services/feed-stock.service';
import { FeedRationResolverService } from '../../application/services/feed-ration-resolver.service';
import { AssignCattleDto } from '../dto/assign-cattle.dto';
import { BulkDeleteStockDto } from '../dto/bulk-delete-stock.dto';
import {
  BulkDeleteConcentrationDto,
  CreateConcentrationDto,
  FinalizeConcentrationDto,
  ListConcentrationsQueryDto,
  NormalizeConcentrationDto,
  UpdateConcentrationDto,
} from '../dto/concentration.dto';
import { ListIngredientsQueryDto } from '../dto/list-ingredients-query.dto';
import { ListFeedStockQueryDto } from '../dto/list-feed-stock-query.dto';
import { FeedRequirementsQueryDto } from '../dto/feed-requirements-query.dto';
import { UpdateRequirementSettingsDto } from '../dto/update-requirement-settings.dto';
import { SetFeedOverrideDto } from '../dto/set-feed-override.dto';
import { CreateCustomIngredientDto } from '../dto/create-custom-ingredient.dto';
import { UpdateCustomIngredientDto } from '../dto/update-custom-ingredient.dto';
import { LogDistributionDto } from '../dto/log-distribution.dto';
import { PatchRefusalDto } from '../dto/patch-refusal.dto';
import { UpdateStockNutritionDto } from '../dto/update-stock-nutrition.dto';
import {
  FeedEfficiencyQueryDto,
  ListDistributionQueryDto,
} from '../dto/list-distribution-query.dto';
import { FeedGridQueryDto } from '../dto/feed-grid-query.dto';
import { SaveFeedDraftDto } from '../dto/save-feed-draft.dto';
import { ConfirmFeedDraftDto } from '../dto/confirm-feed-draft.dto';
import { FeedFeedingGridService } from '../../application/services/feed-feeding-grid.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Feed Formulator (PRD §12 / API §8). `/api/v1/feed`. Token tenancy + RBAC +
 * **subscription gate**: Feed Formulator is a Starter/Pro feature
 * (`feed.formulator`, RAKHAL-219); baseline guard makes it read-only in grace.
 */
@ApiTags('Feed')
@ApiBearerAuth()
@Controller('feed')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
  SubscriptionFeatureGuard,
)
@RequireFeature('feed.formulator')
export class FeedController {
  constructor(
    private readonly ingredients: FeedIngredientService,
    private readonly requirements: FeedRequirementsService,
    private readonly requirementSettings: RequirementSettingsService,
    private readonly concentrations: FeedConcentrationService,
    private readonly groups: FeedGroupAssignService,
    private readonly distributions: FeedDistributionService,
    private readonly stock: FeedStockService,
    private readonly rationResolver: FeedRationResolverService,
    private readonly feedingGrid: FeedFeedingGridService,
  ) {}

  // ---- Ingredients --------------------------------------------------------
  @Get('ingredients')
  @RequirePermission('feed.read')
  listIngredients(
    @CurrentFarmId() farmId: string,
    @Query() query: ListIngredientsQueryDto,
  ) {
    return this.ingredients.listMerged(farmId, query.includeArchived);
  }

  /** Cursor-paginated + filterable ingredients list (search/`feedClass`/price-range) for the
   * Ingredients management table (2026-08-14) — registered before `ingredients/:id/override` so
   * Nest doesn't try to match "paged" as an `:id` (no real conflict, GET vs the override routes'
   * POST/DELETE, kept static for clarity/precedent per this controller's other bulk/static routes). */
  @Get('ingredients/paged')
  @RequirePermission('feed.read')
  listIngredientsPaged(
    @CurrentFarmId() farmId: string,
    @Query() query: ListIngredientsQueryDto,
  ) {
    return this.ingredients.listPaged(farmId, query);
  }

  @Post('ingredients/custom')
  @RequirePermission('feed.create')
  createCustomIngredient(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateCustomIngredientDto,
  ) {
    return this.ingredients.createCustom(farmId, userId, dto);
  }

  @Patch('ingredients/custom/:id')
  @RequirePermission('feed.update')
  updateCustomIngredient(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomIngredientDto,
  ) {
    return this.ingredients.updateCustomIngredient(farmId, id, dto);
  }

  @Delete('ingredients/custom/:id')
  @RequirePermission('feed.delete')
  deactivateCustomIngredient(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
  ) {
    return this.ingredients.deactivateCustomIngredient(farmId, id);
  }

  @Post('ingredients/:id/override')
  @RequirePermission('feed.update')
  setOverride(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: SetFeedOverrideDto,
  ) {
    return this.ingredients.setOverride(farmId, userId, id, dto);
  }

  @Delete('ingredients/:id/override')
  @RequirePermission('feed.update')
  resetOverride(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.ingredients.resetOverride(farmId, id);
  }

  // ---- Requirements -------------------------------------------------------
  @Get('requirements')
  @RequirePermission('feed.read')
  getRequirements(
    @CurrentFarmId() farmId: string,
    @Query() query: FeedRequirementsQueryDto,
  ) {
    return this.requirements.calc(farmId, query);
  }

  /** Farm-wide "Today's Feed Requirement" rollup (2026-08-13, user request). */
  @Get('today-requirement')
  @RequirePermission('feed.read')
  todaysRequirement(@CurrentFarmId() farmId: string) {
    return this.requirements.getTodaysRequirement(farmId);
  }

  // ---- Requirement settings (RAKHAL-409, PRD §12.13) ----------------------
  /**
   * The tuning numbers behind every requirement calculation: the effective values, the
   * layers that produced them (farm changes -> active preset -> built-in defaults), and
   * the field metadata an editor needs to render them.
   */
  @Get('requirement-settings')
  @RequirePermission('feed.read')
  getRequirementSettings(@CurrentFarmId() farmId: string) {
    return this.requirementSettings.describe(farmId);
  }

  /**
   * Change this farm's requirement model. Sparse — only the supplied fields are stored.
   * Applies to future calculations only; nothing already saved is recomputed.
   */
  @Put('requirement-settings')
  @RequirePermission('feed.update')
  updateRequirementSettings(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: UpdateRequirementSettingsDto,
  ) {
    return this.requirementSettings.saveFarmChanges(
      farmId,
      userId,
      dto.changes,
      dto.notes,
    );
  }

  /** Drop this farm's changes and go back to the standard model. */
  @Delete('requirement-settings')
  @RequirePermission('feed.update')
  resetRequirementSettings(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.requirementSettings.resetFarmChanges(farmId, userId);
  }

  // ---- Concentration templates -------------------------------------------
  @Get('concentrations')
  @RequirePermission('feed.read')
  listConcentrations(
    @CurrentFarmId() farmId: string,
    @Query() query: ListConcentrationsQueryDto,
  ) {
    return this.concentrations.list(farmId, query.kind, query.includeArchived);
  }

  @Post('concentrations')
  @RequirePermission('feed.create')
  createConcentration(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateConcentrationDto,
  ) {
    return this.concentrations.create(farmId, userId, dto);
  }

  @Post('concentrations/normalize')
  @RequirePermission('feed.read')
  normalize(
    @CurrentFarmId() farmId: string,
    @Body() dto: NormalizeConcentrationDto,
  ) {
    return this.concentrations.normalize(farmId, dto);
  }

  /** Multi-select delete (user request 2026-07-18) — registered before the `:id` routes so Nest
   * doesn't try to match "bulk-delete" as an id (no conflict here since this is POST and the `:id`
   * routes are GET/PATCH/DELETE, but keeping the static route grouped above them for clarity). */
  @Post('concentrations/bulk-delete')
  @RequirePermission('feed.delete')
  bulkDeleteConcentrations(
    @CurrentFarmId() farmId: string,
    @Body() dto: BulkDeleteConcentrationDto,
  ) {
    return this.concentrations.removeMany(farmId, dto.ids);
  }

  @Get('concentrations/:id')
  @RequirePermission('feed.read')
  getConcentration(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.concentrations.get(farmId, id);
  }

  @Patch('concentrations/:id')
  @RequirePermission('feed.update')
  updateConcentration(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConcentrationDto,
  ) {
    return this.concentrations.update(farmId, id, dto);
  }

  @Delete('concentrations/:id')
  @RequirePermission('feed.delete')
  removeConcentration(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
  ) {
    return this.concentrations.remove(farmId, id);
  }

  /** Explicit-checkpoint versioning, `FEED_MIXTURE` only (2026-08-13, user request). */
  @Post('concentrations/:id/save-version')
  @RequirePermission('feed.update')
  saveVersion(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body('name') name?: string,
  ) {
    return this.concentrations.saveAsVersion(farmId, userId, id, name);
  }

  @Get('concentrations/:id/versions')
  @RequirePermission('feed.read')
  listVersions(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.concentrations.listVersions(farmId, id);
  }

  /** Promote this concentration into a reusable, versioned `FeedIngredient` (user request
   * 2026-07-17, "concentrates become reusable ingredients") — see `FeedConcentrationService.finalize`. */
  @Post('concentrations/:id/finalize')
  @RequirePermission('feed.update')
  finalizeConcentration(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: FinalizeConcentrationDto,
  ) {
    return this.concentrations.finalize(
      farmId,
      userId,
      id,
      dto.financialAccountId,
      dto.batchQuantityKg,
    );
  }

  // ---- Layered ration resolution (herd -> group -> individual) ------------
  /** Which active `FEED_MIXTURE` ration this cow is actually on right now, most-specific-wins
   * (2026-08-13, user request). Used by the Cattle feeding tab and DMI comparison. */
  @Get('cattle/:cattleId/resolved-ration')
  @RequirePermission('feed.read')
  async resolvedRation(
    @CurrentFarmId() farmId: string,
    @Param('cattleId') cattleId: string,
  ) {
    const resolved = await this.rationResolver.resolveActiveRation(
      farmId,
      cattleId,
    );
    if (!resolved) return { match_level: null, concentration: null };
    return {
      match_level: resolved.matchLevel,
      concentration: await this.concentrations.get(
        farmId,
        resolved.concentration.id,
      ),
    };
  }

  /** Actual vs expected dry-matter intake for a cow (2026-08-13, user request). */
  @Get('cattle/:cattleId/dmi')
  @RequirePermission('feed.read')
  dmiComparison(
    @CurrentFarmId() farmId: string,
    @Param('cattleId') cattleId: string,
    @Query('date') date?: string,
  ) {
    return this.distributions.getDmiComparison(farmId, cattleId, date);
  }

  // ---- Feed group ↔ cattle ------------------------------------------------
  @Get('groups/:id/cattle')
  @RequirePermission('feed.read')
  groupCattle(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.groups.listCattle(farmId, id);
  }

  @Post('groups/:id/assign-cattle')
  @RequirePermission('feed.update')
  assignCattle(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: AssignCattleDto,
  ) {
    return this.groups.assignCattle(farmId, id, dto.cattleIds);
  }

  // ---- Feed distribution (§12.5) -----------------------------------------
  @Get('distributions')
  @RequirePermission('feed.read')
  listDistributions(
    @CurrentFarmId() farmId: string,
    @Query() query: ListDistributionQueryDto,
  ) {
    return this.distributions.list(farmId, query);
  }

  @Post('distributions')
  @RequirePermission('feed.distribution-log')
  logDistribution(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: LogDistributionDto,
  ) {
    return this.distributions.create(farmId, userId, dto);
  }

  // ---- Feeding Grid (2026-08-15, replaces Quick Feed) ---------------------
  /** One day's per-cow feeding grid — existing drafts for that day + each cow's carried-forward
   * default (most recent confirmed per-head quantity), optionally scoped to one feed group. */
  @Get('grid')
  @RequirePermission('feed.read')
  getFeedingGrid(
    @CurrentFarmId() farmId: string,
    @Query() query: FeedGridQueryDto,
  ) {
    return this.feedingGrid.getGrid(farmId, query.date, query.feedGroupId);
  }

  /** Auto-save a day's per-cow grid quantities for one feed source. No inventory effect. */
  @Post('grid/draft')
  @RequirePermission('feed.distribution-log')
  saveFeedDraft(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: SaveFeedDraftDto,
  ) {
    return this.feedingGrid.saveDraft(farmId, userId, dto);
  }

  /** Turn a day's feeding-grid quantities into one real `FeedDistribution` + inventory decrement. */
  @Post('grid/confirm')
  @RequirePermission('feed.distribution-log')
  confirmFeedDraft(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: ConfirmFeedDraftDto,
  ) {
    return this.feedingGrid.confirm(farmId, userId, dto);
  }

  /** Farm-wide feed cost/cow/day + cost/litre + trend (2026-08-13, user request — Dashboard +
   * Reports need this, not just the per-lactation view Reproduction already has). */
  @Get('cost-summary')
  @RequirePermission('feed.read')
  costSummary(@CurrentFarmId() farmId: string, @Query('days') days?: string) {
    return this.distributions.getFarmFeedCostSummary(
      farmId,
      days ? Number(days) : undefined,
    );
  }

  @Get('efficiency')
  @RequirePermission('feed.read')
  efficiency(
    @CurrentFarmId() farmId: string,
    @Query() query: FeedEfficiencyQueryDto,
  ) {
    return this.distributions.efficiency(farmId, query);
  }

  @Get('distributions/:id')
  @RequirePermission('feed.read')
  getDistribution(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.distributions.get(farmId, id);
  }

  /** Next-day leftover weigh-in (2026-08-13, user request). */
  @Patch('distributions/:id/refusal')
  @RequirePermission('feed.distribution-log')
  patchRefusal(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: PatchRefusalDto,
  ) {
    return this.distributions.patchRefusal(farmId, id, dto);
  }

  @Get('groups/:id/refusal-trend')
  @RequirePermission('feed.read')
  refusalTrend(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    return this.distributions.getRefusalTrend(
      farmId,
      id,
      days ? Number(days) : undefined,
    );
  }

  // ---- Feed stock (§12.5 follow-up — TMR ↔ Inventory linkage) -------------
  @Get('stock')
  @RequirePermission('feed.read')
  listStock(
    @CurrentFarmId() farmId: string,
    @Query() query: ListFeedStockQueryDto,
  ) {
    return this.stock.list(farmId, query.includeArchived);
  }

  /** Multi-select delete (bulk-action dock, 2026-07-21) — registered before `stock/:id` so Nest
   * doesn't try to match "bulk-delete" as an id (no real conflict here since this is POST and the
   * `:id` routes are GET/DELETE, but keeping it grouped for clarity/precedent). */
  @Post('stock/bulk-delete')
  @RequirePermission('feed.delete')
  bulkDeleteStock(
    @CurrentFarmId() farmId: string,
    @Body() dto: BulkDeleteStockDto,
  ) {
    return this.stock.removeMany(farmId, dto.ids);
  }

  @Get('stock/:id')
  @RequirePermission('feed.read')
  getStock(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.stock.get(farmId, id);
  }

  /** Delete a stock lot from inventory (user request 2026-07-19 — "form inventory it can be also
   * deleted"). Soft-delete, same as `removeConcentration` above. */
  @Delete('stock/:id')
  @RequirePermission('feed.delete')
  archiveStock(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.stock.archive(farmId, id);
  }

  /** RAKHAL-327: correct a produced batch's nutrient snapshot once real data comes back (e.g. a
   * lab report) — the recipe's on-paper values at finalize time are only a starting estimate. */
  @Patch('stock/:id/nutrition')
  @RequirePermission('feed.update')
  updateStockNutrition(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStockNutritionDto,
  ) {
    return this.stock.updateNutrition(farmId, id, dto);
  }
}
