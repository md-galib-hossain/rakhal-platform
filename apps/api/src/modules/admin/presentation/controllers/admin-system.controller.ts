import { Controller, Get, UseGuards } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiEnvelopeResponse } from 'src/common/swagger/api-envelope';
import { AdminCronListResponseDto } from '../dto/admin-system-response.dto';
import { AdminIpAllowlistGuard } from '../guards/admin-ip-allowlist.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { RequireAdminPermission } from '../decorators/require-admin-permission.decorator';

/**
 * Cross-project cron visibility (RD-013b follow-up). Every `@Cron(expr, { name })`
 * job in the app — regardless of which domain module declares it (Reports'
 * `ReportScheduleRunner`/`ReportCleanupRunner`, the Scheduler module's daily
 * notification sweeps, etc.) — auto-registers with `@nestjs/schedule`'s
 * `SchedulerRegistry`. Reading that registry here gives one list of every
 * cron in the project without a shared "CronModule" importing every domain
 * module those jobs touch (would create a god-module coupling everything).
 */
@ApiTags('Admin — System')
@ApiBearerAuth()
@Controller('admin/crons')
@UseGuards(AdminIpAllowlistGuard, PlatformAdminGuard, AdminPermissionGuard)
export class AdminSystemController {
  constructor(private readonly registry: SchedulerRegistry) {}

  @Get()
  @ApiEnvelopeResponse(AdminCronListResponseDto)
  @RequireAdminPermission('system.read')
  list() {
    const jobs = this.registry.getCronJobs();
    return {
      crons: Array.from(jobs.entries()).map(([name, job]) => ({
        name,
        running: job.isActive,
        next_run: job.isActive ? job.nextDate().toISO() : null,
        last_run: job.lastDate()?.toISOString() ?? null,
      })),
    };
  }
}

// Compile-time guard (RD-140): the documented cron response must match what `list()` really returns.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type AdminCronShapeGuards = [
  Assert<
    Same<ReturnType<AdminSystemController['list']>, AdminCronListResponseDto>
  >,
];
