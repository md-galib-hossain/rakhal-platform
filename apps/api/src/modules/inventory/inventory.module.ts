import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { NotificationModule } from '../notification/notification.module';
import { ActivityModule } from '../activity/activity.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MediaModule } from '../media/media.module';
import { MedicineService } from './application/services/medicine.service';
import { FeedItemService } from './application/services/feed-item.service';
import { SemenService } from './application/services/semen.service';
import { MilkTankService } from './application/services/milk-tank.service';
import { EquipmentService } from './application/services/equipment.service';
import { UnitService } from './application/services/unit.service';
import { InventoryActivityService } from './application/services/inventory-activity.service';
import { NutritionProfileModule } from '../feed/nutrition-profile.module';
import { MedicineController } from './presentation/controllers/medicine.controller';
import { FeedItemController } from './presentation/controllers/feed-item.controller';
import { SemenController } from './presentation/controllers/semen.controller';
import { MilkTankController } from './presentation/controllers/milk-tank.controller';
import { EquipmentController } from './presentation/controllers/equipment.controller';
import { UnitController } from './presentation/controllers/unit.controller';

/**
 * Inventory module (PRD §15). Tabs: Medicine (RAKHAL-074), Feed (075, purchased
 * stock — forage/concentrate/mineral/vitamin/additive, `feedClass`-tagged),
 * Equipment/Others (076), Semen tanks + batches (077), Milk tanks + audit log (078).
 *
 * Services are exported so cross-module integrations can consume them:
 *  - `SemenService.decrementStraw` ← Reproduction AI (REP-05)
 *  - `MilkTankService.adjustVolume` ← Milk submit (COLLECTION) / Finance sale (SALE)
 *  - `MedicineService` ← Healthcare treatment decrement (HLT-07)
 *
 * Imports AuthModule + TenantAccessModule so the controllers'
 * JwtAuthGuard / SessionGuard / FarmContextGuard resolve.
 */
@Module({
  imports: [
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    LoggerModule,
    NotificationModule,
    SubscriptionModule,
    MediaModule,
    ActivityModule,
    NutritionProfileModule,
  ],
  controllers: [
    MedicineController,
    FeedItemController,
    SemenController,
    MilkTankController,
    EquipmentController,
    UnitController,
  ],
  providers: [
    MedicineService,
    FeedItemService,
    SemenService,
    MilkTankService,
    EquipmentService,
    UnitService,
    InventoryActivityService,
  ],
  exports: [
    MedicineService,
    FeedItemService,
    SemenService,
    MilkTankService,
    EquipmentService,
    UnitService,
  ],
})
export class InventoryModule {}
