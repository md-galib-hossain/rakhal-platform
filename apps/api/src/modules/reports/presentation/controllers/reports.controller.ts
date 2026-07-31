import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  CurrentFarmId,
  CurrentUserId,
  ThrottleExpensive,
} from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { SubscriptionFeatureGuard } from 'src/modules/subscription/presentation/guards/subscription-feature.guard';
import { RequireFeature } from 'src/modules/subscription/presentation/decorators/require-feature.decorator';
import { ReportsService } from '../../application/services/reports.service';
import { ReportScheduleService } from '../../application/services/report-schedule.service';
import { GenerateReportDto } from '../dto/generate-report.dto';
import { CreateReportScheduleDto } from '../dto/create-report-schedule.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Reports (PRD §22 / API §15). `/api/v1/reports`. Token tenancy + RBAC +
 * **subscription gate**: the Reports engine is a Pro feature (`reports.generate`,
 * RAKHAL-219), and the baseline `SubscriptionGuard` makes it read-only in grace.
 */
@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
  SubscriptionFeatureGuard,
)
@RequireFeature('reports.generate')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly scheduleService: ReportScheduleService,
  ) {}

  @Get()
  @RequirePermission('reports.read')
  catalogue(@CurrentFarmId() farmId: string) {
    return this.reportsService.catalogue(farmId);
  }

  @Post('generate')
  @RequirePermission('reports.create')
  @UseGuards(ThrottlerGuard)
  @ThrottleExpensive()
  generate(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: GenerateReportDto,
  ) {
    return this.reportsService.generate(farmId, userId, dto);
  }

  @Get('jobs/:id')
  @RequirePermission('reports.read')
  getJob(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.reportsService.getJob(farmId, id);
  }

  @Get('jobs/:id/download')
  @RequirePermission('reports.read')
  async download(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    // Resolve before touching `res` so not-found / expired / not-ready still
    // flow to the global exception filter. On success we own the raw response
    // (non-passthrough `@Res`), bypassing the JSON envelope/serialization.
    const file = await this.reportsService.download(farmId, id);
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
      'Content-Length': String(file.buffer.length),
    });
    res.send(file.buffer);
  }

  @Post('schedules')
  @RequirePermission('reports.schedule')
  @RequireFeature('reports.scheduled')
  createSchedule(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateReportScheduleDto,
  ) {
    return this.scheduleService.create(farmId, userId, dto);
  }

  @Get('schedules')
  @RequirePermission('reports.read')
  @RequireFeature('reports.scheduled')
  listSchedules(@CurrentFarmId() farmId: string) {
    return this.scheduleService.list(farmId);
  }

  @Delete('schedules/:id')
  @RequirePermission('reports.schedule')
  @RequireFeature('reports.scheduled')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeSchedule(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.scheduleService.remove(farmId, id);
  }
}
