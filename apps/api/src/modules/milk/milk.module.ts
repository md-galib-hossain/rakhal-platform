import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { ActivityModule } from '../activity/activity.module';
import { InventoryModule } from '../inventory/inventory.module';
import { FarmSettingsModule } from '../farm-settings/farm-settings.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { HealthModule } from '../health/health.module';
import { CattleModule } from '../cattle/cattle.module';
import { MilkExportService } from './application/services/milk-export.service';
import { MilkImportService } from './application/services/milk-import.service';
import { MilkQualityService } from './application/services/milk-quality.service';
import { MilkService } from './application/services/milk.service';
import { MilkController } from './presentation/controllers/milk.controller';

@Module({
  imports: [
    AuthModule,
    LoggerModule,
    TenantAccessModule,
    PermissionModule,
    ActivityModule,
    InventoryModule,
    FarmSettingsModule,
    SubscriptionModule,
    HealthModule,
    // AnimalHoldService (RAKHAL-280) — read-only `activeHoldsForCattle` lookup
    // for RAKHAL-278's `DISCARD_REQUIRED` milk-eligibility reason. CattleModule
    // doesn't import MilkModule anywhere, so no circular-dependency risk (same
    // pattern ReproductionModule already established for RAKHAL-272).
    CattleModule,
  ],
  controllers: [MilkController],
  providers: [
    MilkService,
    MilkImportService,
    MilkExportService,
    MilkQualityService,
  ],
  exports: [MilkService, MilkQualityService],
})
export class MilkModule {}
