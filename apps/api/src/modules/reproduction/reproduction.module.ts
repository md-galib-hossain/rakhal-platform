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
import { ReproductionService } from './application/services/reproduction.service';
import { ReproProtocolService } from './application/services/repro-protocol.service';
import { CattleReproductionController } from './presentation/controllers/cattle-reproduction.controller';
import { ReproductionController } from './presentation/controllers/reproduction.controller';
import { ReproProtocolController } from './presentation/controllers/repro-protocol.controller';

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
  ],
  controllers: [
    ReproductionController,
    CattleReproductionController,
    ReproProtocolController,
  ],
  providers: [ReproductionService, ReproProtocolService],
  exports: [ReproductionService],
})
export class ReproductionModule {}
