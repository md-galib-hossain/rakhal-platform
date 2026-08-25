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
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { HealthService } from '../../application/services/health.service';
import {
  ApplyHealthPlanDto,
  CloseHealthCaseDto,
  CreateHealthUpdateDto,
  LogTreatmentDto,
  MortalityDto,
  RescheduleHealthTaskDto,
  SkipHealthTaskDto,
} from '../dto/case-actions.dto';
import { CreateHealthCaseDto } from '../dto/create-health-case.dto';
import { UpdateHealthCaseDto } from '../dto/update-health-case.dto';
import {
  CreateHealthPlanDto,
  UpdateHealthPlanDto,
} from '../dto/health-plan.dto';
import {
  HealthPlanQueryDto,
  HealthTaskCalendarQueryDto,
  HealthTaskQueryDto,
  SafetyWithdrawalQueryDto,
  SickBayQueryDto,
} from '../dto/health-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Healthcare (PRD §13). `/api/v1/health`. Token tenancy + RBAC. */
@ApiTags('Health')
@ApiBearerAuth()
@Controller('health')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('dashboard')
  @RequirePermission('healthcare.read')
  dashboard(@CurrentFarmId() farmId: string) {
    return this.healthService.getHealthDashboard(farmId);
  }

  @Get('sick-bay')
  @RequirePermission('healthcare.read')
  sickBay(@CurrentFarmId() farmId: string, @Query() query: SickBayQueryDto) {
    return this.healthService.getSickBay(farmId, query);
  }

  @Post('cases')
  @RequirePermission('healthcare.report-sickness')
  createCase(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateHealthCaseDto,
  ) {
    return this.healthService.createHealthCase(farmId, userId, dto);
  }

  @Get('cases/:id')
  @RequirePermission('healthcare.read')
  getCase(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.healthService.getHealthCase(farmId, id);
  }

  @Patch('cases/:id')
  @RequirePermission('healthcare.update')
  updateCase(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHealthCaseDto,
  ) {
    return this.healthService.updateHealthCase(farmId, id, dto);
  }

  @Delete('cases/:id')
  @RequirePermission('healthcare.delete')
  deleteCase(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.healthService.deleteCase(farmId, id);
  }

  @Post('cases/:id/apply-plan')
  @RequirePermission('healthcare.update')
  applyPlan(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: ApplyHealthPlanDto,
  ) {
    return this.healthService.applyHealthPlanToCase(farmId, id, dto);
  }

  @Post('cases/:id/log-treatment')
  @RequirePermission('healthcare.log-treatment')
  logTreatment(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: LogTreatmentDto,
  ) {
    return this.healthService.logTreatment(farmId, userId, id, dto);
  }

  @Post('cases/:id/health-update')
  @RequirePermission('healthcare.log-treatment')
  healthUpdate(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: CreateHealthUpdateDto,
  ) {
    return this.healthService.createHealthUpdate(farmId, userId, id, dto);
  }

  @Post('cases/:id/close')
  @RequirePermission('healthcare.close-case')
  closeCase(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: CloseHealthCaseDto,
  ) {
    return this.healthService.closeCase(farmId, userId, id, dto);
  }

  @Post('cases/:id/mortality')
  @RequirePermission('healthcare.close-case')
  mortality(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: MortalityDto,
  ) {
    return this.healthService.logMortality(farmId, userId, id, dto);
  }

  @Get('plans')
  @RequirePermission('healthcare.read')
  getPlans(
    @CurrentFarmId() farmId: string,
    @Query() query: HealthPlanQueryDto,
  ) {
    return this.healthService.getPlans(farmId, query);
  }

  @Post('plans')
  @RequirePermission('healthcare.create')
  createPlan(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateHealthPlanDto,
  ) {
    return this.healthService.createPlan(farmId, userId, dto);
  }

  @Get('plans/:id')
  @RequirePermission('healthcare.read')
  getPlan(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.healthService.getPlan(farmId, id);
  }

  @Patch('plans/:id')
  @RequirePermission('healthcare.update')
  updatePlan(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHealthPlanDto,
  ) {
    return this.healthService.updatePlan(farmId, id, dto);
  }

  @Delete('plans/:id')
  @RequirePermission('healthcare.delete')
  deletePlan(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.healthService.deletePlan(farmId, id);
  }

  @Get('tasks')
  @RequirePermission('healthcare.read')
  getTasks(
    @CurrentFarmId() farmId: string,
    @Query() query: HealthTaskQueryDto,
  ) {
    return this.healthService.getTasks(farmId, query);
  }

  @Get('tasks/calendar')
  @RequirePermission('healthcare.read')
  taskCalendar(
    @CurrentFarmId() farmId: string,
    @Query() query: HealthTaskCalendarQueryDto,
  ) {
    return this.healthService.getTaskCalendar(farmId, query);
  }

  @Post('tasks/:id/complete')
  @RequirePermission('healthcare.log-treatment')
  completeTask(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.healthService.completeTask(farmId, id);
  }

  @Post('tasks/:id/reschedule')
  @RequirePermission('healthcare.update')
  rescheduleTask(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: RescheduleHealthTaskDto,
  ) {
    return this.healthService.rescheduleTask(farmId, id, dto);
  }

  @Post('tasks/:id/skip')
  @RequirePermission('healthcare.update')
  skipTask(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: SkipHealthTaskDto,
  ) {
    return this.healthService.skipTask(farmId, id, dto);
  }

  @Get('safety-withdrawals')
  @RequirePermission('healthcare.read')
  getSafetyWithdrawals(
    @CurrentFarmId() farmId: string,
    @Query() query: SafetyWithdrawalQueryDto,
  ) {
    return this.healthService.getSafetyWithdrawals(farmId, query);
  }

  @Post('safety-withdrawals/refresh')
  @RequirePermission('healthcare.update')
  refreshSafetyWithdrawals(@CurrentFarmId() farmId: string) {
    return this.healthService.refreshSafetyWithdrawals(farmId);
  }

  /**
   * RAKHAL-276: the only route that can move a withdrawal to `RELEASED` —
   * an explicit, audited action (never a side effect of a read). Same
   * permission as the sibling refresh route above (manager+, not worker).
   */
  @Post('safety-withdrawals/:id/release')
  @RequirePermission('healthcare.update')
  releaseWithdrawal(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ) {
    return this.healthService.releaseWithdrawal(farmId, id, userId);
  }
}
