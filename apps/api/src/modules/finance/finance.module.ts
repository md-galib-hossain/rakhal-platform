import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { FinanceService } from './application/services/finance.service';
import { FinanceController } from './presentation/controllers/finance.controller';

@Module({
  imports: [AuthModule, LoggerModule, TenantAccessModule, PermissionModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
