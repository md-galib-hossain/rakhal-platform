import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { HealthOutcomesService } from '../../application/services/health-outcomes.service';
import { HealthPlanStatsService } from '../../application/services/health-plan-stats.service';
import { HealthRoundsService } from '../../application/services/health-rounds.service';
import {
  ApplyHealthPlanDto,
  CloseHealthCaseDto,
  CreateHealthUpdateDto,
  LogTaskTreatmentDto,
  LogTreatmentDto,
  MortalityDto,
  RecordTreatmentDto,
  RescheduleHealthTaskDto,
  SkipHealthTaskDto,
} from '../dto/case-actions.dto';
import { CreateHealthCaseDto } from '../dto/create-health-case.dto';
import { BulkCreateHealthCasesDto } from '../dto/bulk-create-health-cases.dto';
import { UpdateHealthCaseDto } from '../dto/update-health-case.dto';
import {
  ApplyPlanToAnimalsDto,
  CreateHealthPlanDto,
  UpdateHealthPlanDto,
} from '../dto/health-plan.dto';
import {
  AppliedPlansQueryDto,
  HealthOutcomesQueryDto,
  HealthPlanQueryDto,
  HealthTaskCalendarQueryDto,
  HealthTaskQueryDto,
  PlanRunsQueryDto,
  SafetyWithdrawalQueryDto,
  SickBayQueryDto,
} from '../dto/health-query.dto';
import {
  AddRoundAnimalsDto,
  RoundGridQueryDto,
  RoundsQueryDto,
  UndoReasonDto,
} from '../dto/health-rounds.dto';
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
  constructor(
    private readonly healthService: HealthService,
    private readonly outcomesService: HealthOutcomesService,
    private readonly planStatsService: HealthPlanStatsService,
    private readonly roundsService: HealthRoundsService,
  ) {}

  @Get('dashboard')
  @RequirePermission('healthcare.read')
  dashboard(@CurrentFarmId() farmId: string) {
    return this.healthService.getHealthDashboard(farmId);
  }

  /** RAKHAL-467: what was the sickness, what did we do, what was the result — over the cases opened in the last
   * `days` days (default 90). */
  @Get('outcomes')
  @RequirePermission('healthcare.read')
  outcomes(
    @CurrentFarmId() farmId: string,
    @Query() query: HealthOutcomesQueryDto,
  ) {
    return this.outcomesService.getOutcomes(farmId, query.days ?? 90);
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

  /** RAKHAL-469 — one condition for several animals at once (an outbreak). Same permission as the single report. */
  @Post('cases/bulk')
  @RequirePermission('healthcare.report-sickness')
  createCasesBulk(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: BulkCreateHealthCasesDto,
  ) {
    return this.healthService.createHealthCasesBulk(farmId, userId, dto);
  }

  @Post('treatments')
  @RequirePermission('healthcare.log-treatment')
  recordTreatment(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: RecordTreatmentDto,
  ) {
    return this.healthService.recordTreatment(farmId, userId, dto);
  }

  /** RAKHAL-415: replaces the removed `GET /health/cases/applied` — reads the new
   * `PlanApplication`/`PlanEnrollment` tables, grouped by round. Not aliased; see
   * `HealthService#getPlanApplications`'s own doc comment. */
  @Get('plan-applications')
  @RequirePermission('healthcare.read')
  getPlanApplications(
    @CurrentFarmId() farmId: string,
    @Query() query: AppliedPlansQueryDto,
  ) {
    return this.healthService.getPlanApplications(farmId, query);
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
  async getPlans(
    @CurrentFarmId() farmId: string,
    @Query() query: HealthPlanQueryDto,
  ) {
    // RAKHAL-466: every plan carries its live result (`stats`) — recovery rate / coverage rate by protocol kind
    return this.planStatsService.attach(
      farmId,
      await this.healthService.getPlans(farmId, query),
    );
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
  async getPlan(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    // MILESTONE 29d: the round sheet reads one protocol (steps + live results), archived ones included
    const plan = await this.healthService.getPlanForView(farmId, id);
    const stats = await this.planStatsService.statsFor(farmId, [plan]);
    return { ...plan, stats: stats.get(plan.id)! };
  }

  /** RAKHAL-470: the animals running one protocol (open cases / active enrollments), paged, each with progress and its
   * next open step. Declared next to `plans/:id`; the extra `/runs` segment keeps the two from colliding. */
  @Get('plans/:id/runs')
  @RequirePermission('healthcare.read')
  getPlanRuns(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Query() query: PlanRunsQueryDto,
  ) {
    return this.healthService.getPlanRuns(farmId, id, query);
  }

  /** RAKHAL-471: protocol rounds — one application of a protocol on one farm day (a real `PlanApplication` for preventive
   * / breeding, derived by plan + day for treatment). Read-only; no `:id` collision (`rounds` is its own segment). */
  @Get('rounds')
  @RequirePermission('healthcare.read')
  getRounds(@CurrentFarmId() farmId: string, @Query() query: RoundsQueryDto) {
    return this.roundsService.list(farmId, query);
  }

  /** RAKHAL-472: the cow × step grid of one round, paged by animal, most urgent first. `roundKey` is opaque. */
  @Get('rounds/:roundKey/grid')
  @RequirePermission('healthcare.read')
  getRoundGrid(
    @CurrentFarmId() farmId: string,
    @Param('roundKey') roundKey: string,
    @Query() query: RoundGridQueryDto,
  ) {
    return this.roundsService.grid(farmId, roundKey, query);
  }

  /** RAKHAL-473: add animals to a round that already exists (up to 100). Animals already on the protocol are skipped. */
  @Post('rounds/:roundKey/animals')
  @RequirePermission('healthcare.update')
  addRoundAnimals(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('roundKey') roundKey: string,
    @Body() dto: AddRoundAnimalsDto,
  ) {
    return this.roundsService.addAnimals(farmId, userId, roundKey, dto);
  }

  /** Undo a whole application (every animal of the round) as a mistake: doses reversed, steps deleted. */
  @Post('rounds/:roundKey/cancel')
  @HttpCode(200)
  @RequirePermission('healthcare.update')
  cancelRound(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('roundKey') roundKey: string,
    @Body() dto: UndoReasonDto,
  ) {
    return this.roundsService.cancelRound(farmId, userId, roundKey, dto.reason);
  }

  /** Void one recorded dose: stock back to its batches, expense reversed, withdrawal cancelled, step back to pending. */
  @Post('treatments/:id/void')
  @HttpCode(200)
  @RequirePermission('healthcare.update')
  voidTreatment(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UndoReasonDto,
  ) {
    return this.healthService.voidTreatmentLog(farmId, userId, id, dto.reason);
  }

  @Get('plans/:id/stock-check')
  @RequirePermission('healthcare.read')
  stockCheck(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Query('animals') animals?: string,
  ) {
    return this.healthService.stockCheck(farmId, id, Number(animals) || 1);
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

  @Post('plans/:id/apply')
  @RequirePermission('healthcare.update')
  applyPlanToAnimals(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: ApplyPlanToAnimalsDto,
  ) {
    return this.healthService.applyPlanToAnimals(farmId, userId, id, dto);
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
  completeTask(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.healthService.completeTask(farmId, userId, id);
  }

  /**
   * RD-093: a caseless (`planEnrollmentId`-only) task's only route to a real dose — see
   * `HealthService#logTaskTreatment`'s doc comment. Rejects a task that still has a
   * `healthCaseId` (use `POST /health/cases/:id/log-treatment` for that one instead).
   */
  @Post('tasks/:id/log-treatment')
  @RequirePermission('healthcare.log-treatment')
  logTaskTreatment(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: LogTaskTreatmentDto,
  ) {
    return this.healthService.logTaskTreatment(farmId, userId, id, dto);
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
