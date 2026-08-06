import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { ActivityModule } from '../activity/activity.module';
import { TaskModule } from '../task/task.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CalfModule } from '../calf/calf.module';
import { FarmSettingsModule } from '../farm-settings/farm-settings.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CattleModule } from '../cattle/cattle.module';
import { ReproductionService } from './application/services/reproduction.service';
import { ReproProtocolService } from './application/services/repro-protocol.service';
import { LactationStatsService } from './application/services/lactation-stats.service';
import { CattleReproductionController } from './presentation/controllers/cattle-reproduction.controller';
import { ReproductionController } from './presentation/controllers/reproduction.controller';
import { ReproProtocolController } from './presentation/controllers/repro-protocol.controller';
import { LactationController } from './presentation/lactation.controller';

@Module({
  imports: [
    AuthModule,
    LoggerModule,
    TenantAccessModule,
    PermissionModule,
    ActivityModule,
    TaskModule,
    InventoryModule,
    CalfModule,
    FarmSettingsModule,
    SubscriptionModule,
    // AnimalHoldService (RAKHAL-280) — read-only `activeHoldsForCattle` lookup
    // for the `REPRODUCTIVE_HOLD` alert (RAKHAL-272). CattleModule doesn't
    // import ReproductionModule anywhere, so this direction has no circular-
    // dependency risk.
    CattleModule,
  ],
  controllers: [
    ReproductionController,
    CattleReproductionController,
    ReproProtocolController,
    LactationController,
  ],
  providers: [ReproductionService, ReproProtocolService, LactationStatsService],
  exports: [ReproductionService],
})
export class ReproductionModule {}
