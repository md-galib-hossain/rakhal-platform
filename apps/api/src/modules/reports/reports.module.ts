import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { ReportGeneratorsService } from './application/services/report-generators.service';
import { ReportsService } from './application/services/reports.service';
import { ReportsController } from './presentation/controllers/reports.controller';

/**
 * Reports module (PRD §22 / API §15). Read-only report generation; aggregates
 * the already-built modules' tables directly via Prisma (Dashboard pattern), so
 * it needs no cross-module service imports (and creates no cycles).
 */
@Module({
  imports: [AuthModule, LoggerModule, TenantAccessModule, PermissionModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportGeneratorsService],
  exports: [ReportsService],
})
export class ReportsModule {}
