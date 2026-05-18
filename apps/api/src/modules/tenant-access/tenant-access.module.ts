import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { TenantAccessService } from './tenant-access.service';
import { FarmMembershipGuard } from './guards/farm-membership.guard';

@Module({
  imports: [LoggerModule],
  providers: [TenantAccessService, FarmMembershipGuard],
  exports: [TenantAccessService, FarmMembershipGuard],
})
export class TenantAccessModule {}
