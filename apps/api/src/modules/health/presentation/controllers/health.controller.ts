import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedHttpRequest } from 'src/modules/auth/domain/authenticated-http-request.type';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
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

@Controller('health')
@UseGuards(JwtAuthGuard, SessionGuard)
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('dashboard')
  dashboard(
    @Query('organizationId') organizationId: string,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.healthService.getHealthDashboard(
      this.userId(request),
      organizationId,
    );
  }

  @Get('sick-bay')
  sickBay(@Query() query: SickBayQueryDto, @Req() request: AuthenticatedHttpRequest) {
    return this.healthService.getSickBay(this.userId(request), query);
  }

  @Post('cases')
  createCase(@Body() dto: CreateHealthCaseDto, @Req() request: AuthenticatedHttpRequest) {
    return this.healthService.createHealthCase(this.userId(request), dto);
  }

  @Get('cases/:id')
  getCase(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.healthService.getHealthCase(this.userId(request), id);
  }

  @Patch('cases/:id')
  updateCase(
    @Param('id') id: string,
    @Body() dto: UpdateHealthCaseDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.healthService.updateHealthCase(this.userId(request), id, dto);
  }

  @Post('cases/:id/apply-plan')
  applyPlan(
    @Param('id') id: string,
    @Body() dto: ApplyHealthPlanDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.healthService.applyHealthPlanToCase(this.userId(request), id, dto);
  }

  @Post('cases/:id/log-treatment')
  logTreatment(
    @Param('id') id: string,
    @Body() dto: LogTreatmentDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.healthService.logTreatment(this.userId(request), id, dto);
  }

  @Post('cases/:id/health-update')
  healthUpdate(
    @Param('id') id: string,
    @Body() dto: CreateHealthUpdateDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.healthService.createHealthUpdate(this.userId(request), id, dto);
  }

  @Post('cases/:id/close')
  closeCase(
    @Param('id') id: string,
    @Body() dto: CloseHealthCaseDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.healthService.closeCase(this.userId(request), id, dto);
  }

  @Post('cases/:id/mortality')
  mortality(
    @Param('id') id: string,
    @Body() dto: MortalityDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.healthService.logMortality(this.userId(request), id, dto);
  }

  @Get('plans')
  getPlans(@Query() query: HealthPlanQueryDto, @Req() request: AuthenticatedHttpRequest) {
    return this.healthService.getPlans(this.userId(request), query);
  }

  @Post('plans')
  createPlan(@Body() dto: CreateHealthPlanDto, @Req() request: AuthenticatedHttpRequest) {
    return this.healthService.createPlan(this.userId(request), dto);
  }

  @Get('plans/:id')
  getPlan(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.healthService.getPlan(this.userId(request), id);
  }

  @Patch('plans/:id')
  updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdateHealthPlanDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.healthService.updatePlan(this.userId(request), id, dto);
  }

  @Delete('plans/:id')
  deletePlan(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.healthService.deletePlan(this.userId(request), id);
  }

  @Get('tasks')
  getTasks(@Query() query: HealthTaskQueryDto, @Req() request: AuthenticatedHttpRequest) {
    return this.healthService.getTasks(this.userId(request), query);
  }

  @Get('tasks/calendar')
  taskCalendar(
    @Query() query: HealthTaskCalendarQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.healthService.getTaskCalendar(this.userId(request), query);
  }

  @Post('tasks/:id/complete')
  completeTask(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.healthService.completeTask(this.userId(request), id);
  }

  @Post('tasks/:id/reschedule')
  rescheduleTask(
    @Param('id') id: string,
    @Body() dto: RescheduleHealthTaskDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.healthService.rescheduleTask(this.userId(request), id, dto);
  }

  @Post('tasks/:id/skip')
  skipTask(
    @Param('id') id: string,
    @Body() dto: SkipHealthTaskDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.healthService.skipTask(this.userId(request), id, dto);
  }

  @Get('safety-withdrawals')
  getSafetyWithdrawals(
    @Query() query: SafetyWithdrawalQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.healthService.getSafetyWithdrawals(this.userId(request), query);
  }

  @Post('safety-withdrawals/refresh')
  refreshSafetyWithdrawals(
    @Query('organizationId') organizationId: string,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.healthService.refreshSafetyWithdrawals(
      this.userId(request),
      organizationId,
    );
  }

  private userId(request: AuthenticatedHttpRequest) {
    const userId = request.auth?.user.sub;
    if (!userId) throw new UnauthorizedException('Unauthorized');
    return userId;
  }
}
