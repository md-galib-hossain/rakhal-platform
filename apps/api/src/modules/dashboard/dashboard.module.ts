import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { FinanceModule } from '../finance/finance.module';
import { MilkModule } from '../milk/milk.module';
import { HealthModule } from '../health/health.module';
import { DashboardService } from './application/services/dashboard.service';
import { DashboardController } from './presentation/controllers/dashboard.controller';

/**
 * Dashboard (PRD §7). Read-only cross-module aggregator. Imports the feature
 * modules whose services it composes (Finance/Milk/Health); all other widgets
 * are direct farm-scoped Prisma reads via the global PrismaModule.
 */
@Module({
  imports: [
    AuthModule,
    LoggerModule,
    TenantAccessModule,
    PermissionModule,
    FinanceModule,
    MilkModule,
    HealthModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
