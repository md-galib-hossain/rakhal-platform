import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { ActivityModule } from '../activity/activity.module';
import { InventoryModule } from '../inventory/inventory.module';
import { TaskModule } from '../task/task.module';
import { CattleModule } from '../cattle/cattle.module';
import { NotificationModule } from '../notification/notification.module';
import { HealthService } from './application/services/health.service';
import { HealthReminderService } from './application/services/health-reminder.service';
import { ProtocolStockService } from './application/services/protocol-stock.service';
import { HealthCycleService } from './application/services/health-cycle.service';
import { HealthOutcomesService } from './application/services/health-outcomes.service';
import { HealthPlanStatsService } from './application/services/health-plan-stats.service';
import { HealthRoundsService } from './application/services/health-rounds.service';
import { CattleHealthController } from './presentation/controllers/cattle-health.controller';
import { HealthController } from './presentation/controllers/health.controller';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PurchasingModule } from '../purchasing/purchasing.module';

@Module({
  imports: [
    AuthModule,
    LoggerModule,
    TenantAccessModule,
    PermissionModule,
    ActivityModule,
    InventoryModule,
    TaskModule,
    NotificationModule,
    SubscriptionModule,
    CattleModule,
    // RAKHAL-419: ExpenseService for treatment-cost posting (same wiring
    // reproduction.module.ts already uses for breeding-cost posting).
    PurchasingModule,
  ],
  controllers: [HealthController, CattleHealthController],
  providers: [
    HealthService,
    ProtocolStockService,
    HealthCycleService,
    HealthReminderService,
    HealthOutcomesService,
    HealthPlanStatsService,
    HealthRoundsService,
  ],
  exports: [
    HealthService,
    ProtocolStockService,
    HealthCycleService,
    HealthReminderService,
    HealthOutcomesService,
    HealthPlanStatsService,
    HealthRoundsService,
  ],
})
export class HealthModule {}
