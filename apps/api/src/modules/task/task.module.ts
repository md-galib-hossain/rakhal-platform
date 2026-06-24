import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { TaskService } from './application/services/task.service';
import { TaskController } from './presentation/controllers/task.controller';

/**
 * Task Hub module (RAKHAL-094) + internal task-creation API (RAKHAL-097).
 * `TaskService` is exported so Reproduction / Healthcare / Calves can call
 * `createInternal(...)` to spawn system tasks (pregnancy check, colostrum,
 * health-plan doses) that surface in the same Task Hub.
 */
@Module({
  imports: [AuthModule, TenantAccessModule, PermissionModule, LoggerModule],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
