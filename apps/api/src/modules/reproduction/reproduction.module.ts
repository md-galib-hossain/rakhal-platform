import { Module, forwardRef } from '@nestjs/common';
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
import { PurchasingModule } from '../purchasing/purchasing.module';
import { CattleModule } from '../cattle/cattle.module';
import { AnimalEventsModule } from '../animal-events/animal-events.module';
import { ReproductionEventHandler } from './application/events/reproduction-events.handler';
import { ReproductionService } from './application/services/reproduction.service';
import { ReproductionDerivationService } from './application/services/reproduction-derivation.service';
import { ReproductionEditService } from './application/services/reproduction-edit.service';
import { ReproductionCalvingEditService } from './application/services/reproduction-calving-edit.service';
import { ReproProtocolService } from './application/services/repro-protocol.service';
import { LactationStatsService } from './application/services/lactation-stats.service';
import { LactationEconomicsService } from './application/services/lactation-economics.service';
import { CattleReproductionController } from './presentation/controllers/cattle-reproduction.controller';
import { ReproductionController } from './presentation/controllers/reproduction.controller';
import { ReproProtocolController } from './presentation/controllers/repro-protocol.controller';
import { LactationController } from './presentation/lactation.controller';

@Module({
  imports: [
    AnimalEventsModule,
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
    // RAKHAL-354: `PurchasingModule` (was `FinanceModule`, V1) — breeding-cost
    // posting migrated to `ExpenseService.recordExpense`/`.reverseExpense`.
    PurchasingModule,
    // AnimalHoldService (RAKHAL-280) — read-only `activeHoldsForCattle` lookup
    // for the `REPRODUCTIVE_HOLD` alert (RAKHAL-272). RAKHAL-307 made this a
    // real cycle (CattleService.create() now also needs
    // ReproductionDerivationService) — forwardRef() on both sides.
    forwardRef(() => CattleModule),
  ],
  controllers: [
    ReproductionController,
    CattleReproductionController,
    ReproProtocolController,
    LactationController,
  ],
  providers: [
    ReproductionService,
    ReproductionDerivationService,
    ReproductionEditService,
    ReproductionCalvingEditService,
    ReproProtocolService,
    LactationStatsService,
    LactationEconomicsService,
    ReproductionEventHandler,
  ],
  exports: [ReproductionService, ReproductionDerivationService],
})
export class ReproductionModule {}
