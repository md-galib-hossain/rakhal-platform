import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { CalfService } from './application/services/calf.service';
import { CalfController } from './presentation/controllers/calf.controller';

@Module({
  imports: [AuthModule, LoggerModule, TenantAccessModule, PermissionModule],
  controllers: [CalfController],
  providers: [CalfService],
  exports: [CalfService],
})
export class CalfModule {}
