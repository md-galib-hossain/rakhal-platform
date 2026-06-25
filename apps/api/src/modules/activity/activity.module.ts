import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { ActivityLogService } from './application/services/activity-log.service';
import { AqrService } from './application/services/aqr.service';
import { AqrConfigService } from './application/services/aqr-config.service';
import { ActivityController } from './presentation/controllers/activity.controller';

/**
 * Activity Log + AQR module (RAKHAL-033). The cross-cutting audit/scoring spine:
 * other feature modules import this and inject `ActivityLogService` (append
 * immutable events) and `AqrService` (apply AQR deltas) on their domain events.
 */
@Module({
  imports: [AuthModule, TenantAccessModule, PermissionModule, LoggerModule],
  controllers: [ActivityController],
  providers: [ActivityLogService, AqrService, AqrConfigService],
  exports: [ActivityLogService, AqrService, AqrConfigService],
})
export class ActivityModule {}
