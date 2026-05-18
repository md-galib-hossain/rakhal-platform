import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { PermissionGuard } from './guards/permission.guard';
import { PermissionService } from './permission.service';

@Module({
  imports: [LoggerModule],
  providers: [PermissionService, PermissionGuard],
  exports: [PermissionService, PermissionGuard],
})
export class PermissionModule {}
