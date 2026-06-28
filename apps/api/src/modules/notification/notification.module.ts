import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { NotificationService } from './application/services/notification.service';
import { NotificationDeliveryService } from './application/services/notification-delivery.service';
import { NotificationController } from './presentation/controllers/notification.controller';

/**
 * Notification engine (PRD §20 / API §17). Exports `NotificationService` so other
 * modules can emit via `notifyUsers(...)` on their events (incremental adoption,
 * like `TaskService.createInternal`). External-channel delivery is a stubbed seam.
 */
@Module({
  imports: [AuthModule, LoggerModule, TenantAccessModule, PermissionModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationDeliveryService],
  exports: [NotificationService],
})
export class NotificationModule {}
