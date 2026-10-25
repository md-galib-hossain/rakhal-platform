import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ThrottleExpensive } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { SubscriptionFeatureGuard } from 'src/modules/subscription/presentation/guards/subscription-feature.guard';
import { RequireFeature } from 'src/modules/subscription/presentation/decorators/require-feature.decorator';
import { ReportsApiService } from '../../application/api/reports-api.service';
import type { ReportCaller } from '../../application/api/reports-api.types';
import { Caller } from '../decorators/report-caller.decorator';
import {
  CreateReportDto,
  ListReportsQueryDto,
  PreviewReportDto,
  ReportIdParamDto,
} from '../dto/reports.dto';

/**
 * Reports v2 (RPT-08, `customer-api`). `/api/v1/reports`. Farm chain + RBAC; generation routes are
 * additionally gated on the `reports.generate` plan feature. Business rules live in
 * {@link ReportsApiService}; every not-found / cross-farm / finance-hidden path answers the same 404.
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
export class ReportsController {
  constructor(private readonly reports: ReportsApiService) {}

  @Get('templates')
  @RequirePermission('reports.read')
  templates(@Caller() caller: ReportCaller) {
    return this.reports.templates(caller);
  }

  @Post('preview')
  @RequirePermission('reports.read')
  @RequireFeature('reports.generate')
  // Preview runs the full compute live: tighter than the shared expensive tier (10/min).
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  preview(@Caller() caller: ReportCaller, @Body() dto: PreviewReportDto) {
    return this.reports.preview(caller, dto);
  }

  @Post()
  @RequirePermission('reports.create')
  @RequireFeature('reports.generate')
  @ThrottleExpensive()
  async create(
    @Caller() caller: ReportCaller,
    @Body() dto: CreateReportDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reports.create(caller, dto, idempotencyKey);
    // 201 only when a new report row was created; a duplicate or an idempotent replay is a 200.
    if (result.duplicate || result.replayed) res.status(200);
    return result.duplicate
      ? { duplicate: true, existing: result.existing }
      : { duplicate: false, replayed: result.replayed, report: result.report };
  }

  @Get()
  @RequirePermission('reports.read')
  list(@Caller() caller: ReportCaller, @Query() query: ListReportsQueryDto) {
    return this.reports.list(caller, query);
  }

  @Get(':id')
  @RequirePermission('reports.read')
  getOne(@Caller() caller: ReportCaller, @Param() { id }: ReportIdParamDto) {
    return this.reports.getOne(caller, id);
  }

  @Get(':id/download')
  @RequirePermission('reports.read')
  @ThrottleExpensive()
  async download(
    @Caller() caller: ReportCaller,
    @Param() { id }: ReportIdParamDto,
    @Res() res: Response,
  ): Promise<void> {
    // Resolve before touching `res` so errors still reach the global filter; then own the raw
    // response and bypass the JSON envelope (same pattern as billing receipts).
    const file = await this.reports.download(caller, id);
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
      'Content-Length': String(file.body.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(file.body);
  }

  @Post(':id/retry')
  @RequirePermission('reports.create')
  @RequireFeature('reports.generate')
  @ThrottleExpensive()
  retry(@Caller() caller: ReportCaller, @Param() { id }: ReportIdParamDto) {
    return this.reports.retry(caller, id);
  }

  @Delete(':id')
  @RequirePermission('reports.delete')
  remove(@Caller() caller: ReportCaller, @Param() { id }: ReportIdParamDto) {
    return this.reports.remove(caller, id);
  }
}
