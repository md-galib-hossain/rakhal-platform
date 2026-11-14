import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { TenantAccessService } from './application/services/tenant-access.service';
import { FarmMembershipGuard } from './presentation/guards/farm-membership.guard';
import { FarmContextGuard } from './presentation/guards/farm-context.guard';

@Module({
  imports: [LoggerModule],
  providers: [TenantAccessService, FarmMembershipGuard, FarmContextGuard],
  exports: [TenantAccessService, FarmMembershipGuard, FarmContextGuard],
})
export class TenantAccessModule {}
