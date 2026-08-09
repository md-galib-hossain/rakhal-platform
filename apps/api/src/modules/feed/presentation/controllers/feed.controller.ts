import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { FeedDistributionService } from '../../application/services/feed-distribution.service';
import { FeedStockService } from '../../application/services/feed-stock.service';
import { AssignCattleDto } from '../dto/assign-cattle.dto';
import { BulkDeleteStockDto } from '../dto/bulk-delete-stock.dto';
import {
  BulkDeleteConcentrationDto,
  CreateConcentrationDto,
  ListConcentrationsQueryDto,
  NormalizeConcentrationDto,
  UpdateConcentrationDto,
} from '../dto/concentration.dto';
import { ListIngredientsQueryDto } from '../dto/list-ingredients-query.dto';
import { ListFeedStockQueryDto } from '../dto/list-feed-stock-query.dto';
import { FeedRequirementsQueryDto } from '../dto/feed-requirements-query.dto';
import { SetFeedOverrideDto } from '../dto/set-feed-override.dto';
import { CreateCustomIngredientDto } from '../dto/create-custom-ingredient.dto';
import { LogDistributionDto } from '../dto/log-distribution.dto';
import {
  FeedEfficiencyQueryDto,
  ListDistributionQueryDto,
} from '../dto/list-distribution-query.dto';
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
    private readonly concentrations: FeedConcentrationService,
    private readonly groups: FeedGroupAssignService,
    private readonly distributions: FeedDistributionService,
    private readonly stock: FeedStockService,
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

  @Post('ingredients/custom')
  @RequirePermission('feed.create')
  createCustomIngredient(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateCustomIngredientDto,
  ) {
    return this.ingredients.createCustom(farmId, userId, dto);
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

  /** Promote this concentration into a reusable, versioned `FeedIngredient` (user request
   * 2026-07-17, "concentrates become reusable ingredients") — see `FeedConcentrationService.finalize`. */
  @Post('concentrations/:id/finalize')
  @RequirePermission('feed.update')
  finalizeConcentration(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.concentrations.finalize(farmId, userId, id);
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
}
