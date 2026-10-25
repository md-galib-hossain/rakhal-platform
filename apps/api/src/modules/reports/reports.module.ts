import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { MediaModule } from '../media/media.module';
import { PermissionModule } from '../permission/permission.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { ReportsApiService } from './application/api/reports-api.service';
import { REPORT_LIFECYCLE } from './application/api/reports-api.types';
import { ReportLifecycleService } from './application/pipeline';
import { ReportsController } from './presentation/controllers/reports.controller';
import {
  REPORT_PIPELINE_IMPORTS,
  REPORT_PIPELINE_PROVIDERS,
} from './reports-pipeline.providers';

/**
 * Reports v2 (EPIC_REPORTS). RPT-08 owns the API surface; RPT-09 fills
 * `reports-pipeline.providers.ts` with the queue, compute service and renderer (the ports in
 * `application/ports/report-ports.ts`). PrismaModule and FarmTimeModule are global.
 */
@Module({
  imports: [
    LoggerModule,
    AuthModule,
    AuditModule,
    MediaModule, // OBJECT_STORAGE
    PermissionModule,
    SubscriptionModule,
    TenantAccessModule,
    ...REPORT_PIPELINE_IMPORTS,
  ],
  controllers: [ReportsController],
  providers: [
    ReportsApiService,
    { provide: REPORT_LIFECYCLE, useExisting: ReportLifecycleService },
    ...REPORT_PIPELINE_PROVIDERS,
  ],
})
export class ReportsModule {}
