import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { DashboardService } from '../../application/services/dashboard.service';
import { DashboardPeriodQueryDto } from '../dto/dashboard-query.dto';

/** Dashboard — Morning Briefing (PRD §7). `/api/v1/dashboard`. Token tenancy + RBAC. */
@Controller('dashboard')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

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
