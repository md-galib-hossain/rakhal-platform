import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { ReproductionService } from '../../application/services/reproduction.service';
import { ReproductionListQueryDto } from '../dto/common.dto';
import { ListPregnanciesQueryDto } from '../dto/list-pregnancies-query.dto';
import { ListReproductionCowsQueryDto } from '../dto/list-reproduction-cows-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Reproduction reads (PRD §9). `/api/v1/reproduction`. Token tenancy + RBAC.
 * Every write goes through `POST /cattle/:id/events` (RAKHAL-490 removed the
 * old create/action routes).
 */
@ApiTags('Reproduction')
@ApiBearerAuth()
@Controller('reproduction')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class ReproductionController {
  constructor(private readonly reproductionService: ReproductionService) {}

  @Get('heat-events')
  @RequirePermission('reproduction.read')
  listHeatEvents(
    @CurrentFarmId() farmId: string,
    @Query() query: ReproductionListQueryDto,
  ) {
    return this.reproductionService.listHeatEvents(farmId, query);
  }

  @Get('breeding-events')
  @RequirePermission('reproduction.read')
  listBreedingEvents(
    @CurrentFarmId() farmId: string,
    @Query() query: ReproductionListQueryDto,
  ) {
    return this.reproductionService.listBreedingEvents(farmId, query);
  }

  @Get('breeding-events/:id')
  @RequirePermission('reproduction.read')
  getBreedingEvent(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.reproductionService.getBreedingEvent(farmId, id);
  }

  @Get('pregnancies')
  @RequirePermission('reproduction.read')
  listPregnancies(
    @CurrentFarmId() farmId: string,
    @Query() query: ListPregnanciesQueryDto,
  ) {
    return this.reproductionService.listPregnancies(farmId, query);
  }

  @Get('calving-events')
  @RequirePermission('reproduction.read')
  listCalvingEvents(
    @CurrentFarmId() farmId: string,
    @Query() query: ReproductionListQueryDto,
  ) {
    return this.reproductionService.listCalvingEvents(farmId, query);
  }

  @Get('abortion-events')
  @RequirePermission('reproduction.read')
  listAbortionEvents(
    @CurrentFarmId() farmId: string,
    @Query() query: ReproductionListQueryDto,
  ) {
    return this.reproductionService.listAbortionEvents(farmId, query);
  }

  @Get('lactations')
  @RequirePermission('reproduction.read')
  listLactations(
    @CurrentFarmId() farmId: string,
    @Query() query: ReproductionListQueryDto,
  ) {
    return this.reproductionService.listLactations(farmId, query);
  }

  /** RAKHAL-051: Reproduction dashboard — KPIs + action panels + calving forecast. */
  @Get('dashboard')
  @RequirePermission('reproduction.read')
  dashboard(@CurrentFarmId() farmId: string) {
    return this.reproductionService.dashboard(farmId);
  }

  /** RAKHAL-363: every cow currently in an active reproductive cycle (OPEN /
   * BRED_AWAITING_CONFIRMATION / PREGNANT) — replaces the dashboard's embedded,
   * uncapped, OPEN-only `open_cows[]` list with a proper paginated endpoint. */
  @Get('cows')
  @RequirePermission('reproduction.read')
  listReproductionCows(
    @CurrentFarmId() farmId: string,
    @Query() query: ListReproductionCowsQueryDto,
  ) {
    return this.reproductionService.listReproductionCows(farmId, query);
  }
}
