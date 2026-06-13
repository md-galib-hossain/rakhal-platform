import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { HealthService } from './application/services/health.service';
import { CattleHealthController } from './presentation/controllers/cattle-health.controller';
import { HealthController } from './presentation/controllers/health.controller';

@Module({
  imports: [AuthModule, LoggerModule, TenantAccessModule],
  controllers: [HealthController, CattleHealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
