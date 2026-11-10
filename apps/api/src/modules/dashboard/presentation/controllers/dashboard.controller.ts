import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { DashboardService } from '../../application/services/dashboard.service';
import { DashboardPeriodQueryDto } from '../dto/dashboard-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Dashboard — Morning Briefing (PRD §7). `/api/v1/dashboard`. Token tenancy + RBAC. */
@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview-batch')
  @RequirePermission('dashboard.read')
  overviewBatch(@CurrentFarmId() farmId: string) {
    return this.dashboardService.overviewBatch(farmId);
  }

  @Get('priorities')
  @RequirePermission('dashboard.read')
  priorities(@CurrentFarmId() farmId: string) {
    return this.dashboardService.priorities(farmId);
  }

  @Get('kpis')
  @RequirePermission('dashboard.read')
  kpis(@CurrentFarmId() farmId: string) {
    return this.dashboardService.kpis(farmId);
  }

  @Get('production-summary')
  @RequirePermission('dashboard.read')
  productionSummary(
    @CurrentFarmId() farmId: string,
    @Query() query: DashboardPeriodQueryDto,
  ) {
    return this.dashboardService.productionSummary(farmId, query.period);
  }

  @Get('calving-forecast')
  @RequirePermission('dashboard.read')
  calvingForecast(@CurrentFarmId() farmId: string) {
    return this.dashboardService.calvingForecast(farmId);
  }

  @Get('herd-status')
  @RequirePermission('dashboard.read')
  herdStatus(@CurrentFarmId() farmId: string) {
    return this.dashboardService.herdStatus(farmId);
  }

  @Get('financial-snapshot')
  @RequirePermission('dashboard.read')
  financialSnapshot(@CurrentFarmId() farmId: string) {
    return this.dashboardService.financialSnapshot(farmId);
  }

  @Get('livestock-state')
  @RequirePermission('dashboard.read')
  livestockState(
    @CurrentFarmId() farmId: string,
    @Query() query: DashboardPeriodQueryDto,
  ) {
    return this.dashboardService.livestockState(farmId, query.period);
  }

  @Get('financial-performance')
  @RequirePermission('dashboard.read')
  financialPerformance(@CurrentFarmId() farmId: string) {
    return this.dashboardService.financialPerformance(farmId);
  }

  @Get('production-vs-feedcost')
  @RequirePermission('dashboard.read')
  productionVsFeedcost(@CurrentFarmId() farmId: string) {
    return this.dashboardService.productionVsFeedcost(farmId);
  }

  @Get('conception-rate')
  @RequirePermission('dashboard.read')
  conceptionRate(@CurrentFarmId() farmId: string) {
    return this.dashboardService.conceptionRate(farmId);
  }

  @Get('feed-cost-summary')
  @RequirePermission('dashboard.read')
  feedCostSummary(@CurrentFarmId() farmId: string) {
    return this.dashboardService.feedCostSummary(farmId);
  }

  @Get('feed-stock-alerts')
  @RequirePermission('dashboard.read')
  feedStockAlerts(@CurrentFarmId() farmId: string) {
    return this.dashboardService.feedStockAlerts(farmId);
  }

  @Get('upcoming-tasks')
  @RequirePermission('dashboard.read')
  upcomingTasks(@CurrentFarmId() farmId: string) {
    return this.dashboardService.upcomingTasks(farmId);
  }
}
