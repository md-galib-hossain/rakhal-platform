import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { PermissionService } from './application/services/permission.service';
import { PermissionGuard } from './presentation/guards/permission.guard';

@Module({
  imports: [LoggerModule],
  providers: [PermissionService, PermissionGuard],
  exports: [PermissionService, PermissionGuard],
})
export class PermissionModule {}
