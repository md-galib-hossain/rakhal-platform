import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { NotificationModule } from '../notification/notification.module';
import { TaskNotificationProducer } from './application/resolvers/task-notification.producer';
import { TaskSourceResolver } from './application/resolvers/task-source.resolver';
import { TaskService } from './application/services/task.service';
import { TaskController } from './presentation/controllers/task.controller';

/**
 * Task Hub module (RAKHAL-094) + internal task-creation API (RAKHAL-097).
 * `TaskService` is exported so Reproduction / Healthcare / Calves can call
 * `createInternal(...)` to spawn system tasks (pregnancy check, colostrum,
 * health-plan doses) that surface in the same Task Hub.
 */
@Module({
  imports: [
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    LoggerModule,
    SubscriptionModule,
    NotificationModule,
  ],
  controllers: [TaskController],
  providers: [TaskService, TaskSourceResolver, TaskNotificationProducer],
  exports: [TaskService, TaskNotificationProducer],
})
export class TaskModule {}
