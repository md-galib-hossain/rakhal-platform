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
import { FeedConcentrationService } from '../../application/services/feed-concentration.service';
import { FeedGroupAssignService } from '../../application/services/feed-group-assign.service';
import { FeedIngredientService } from '../../application/services/feed-ingredient.service';
import { FeedRequirementsService } from '../../application/services/feed-requirements.service';
import { AssignCattleDto } from '../dto/assign-cattle.dto';
import {
  CreateConcentrationDto,
  NormalizeConcentrationDto,
  UpdateConcentrationDto,
} from '../dto/concentration.dto';
import { FeedRequirementsQueryDto } from '../dto/feed-requirements-query.dto';
import { SetFeedOverrideDto } from '../dto/set-feed-override.dto';

/** Feed Formulator (PRD §12 / API §8). `/api/v1/feed`. Token tenancy + RBAC. */
@Controller('feed')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class FeedController {
  constructor(
    private readonly ingredients: FeedIngredientService,
    private readonly requirements: FeedRequirementsService,
    private readonly concentrations: FeedConcentrationService,
    private readonly groups: FeedGroupAssignService,
  ) {}

  // ---- Ingredients --------------------------------------------------------
  @Get('ingredients')
  @RequirePermission('feed.read')
  listIngredients(@CurrentFarmId() farmId: string) {
    return this.ingredients.listMerged(farmId);
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
  getRequirements(@Query() query: FeedRequirementsQueryDto) {
    return this.requirements.calc(query);
  }

  // ---- Concentration templates -------------------------------------------
  @Get('concentrations')
  @RequirePermission('feed.read')
  listConcentrations(@CurrentFarmId() farmId: string) {
    return this.concentrations.list(farmId);
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
}
