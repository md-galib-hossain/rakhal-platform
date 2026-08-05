import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { ActivityModule } from '../activity/activity.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MediaModule } from '../media/media.module';
// RAKHAL-279: `CattleService.composeStatus()` reads farm-level reproduction
// thresholds (heat/close-up windows, lactation/pregnancy stage buckets,
// repeat-breeder/long-days-open/calving-overdue thresholds) to feed the
// reproduction domain's pure derive functions directly — see
// `cattle.service.ts`'s `composeStatus()` doc comment for why this avoids
// injecting `ReproductionService` (a real circular-module risk) instead.
// `FarmSettingsModule` is a lean, standalone module (Prisma + Logger only,
// no back-reference to `CattleModule`) so this creates no cycle.
import { FarmSettingsModule } from '../farm-settings/farm-settings.module';
import { AnimalHoldService } from './application/services/animal-hold.service';
import { BcsService } from './application/services/bcs.service';
import { BreedService } from './application/services/breed.service';
import { CattleService } from './application/services/cattle.service';
import { CattleDetailService } from './application/services/cattle-detail.service';
import { CattleImportService } from './application/services/cattle-import.service';
import { ShedService } from './application/services/shed.service';
import { WeightService } from './application/services/weight.service';
import { AnimalHoldController } from './presentation/controllers/animal-hold.controller';
import { BreedController } from './presentation/controllers/breed.controller';
import { CattleController } from './presentation/controllers/cattle.controller';
import { ShedController } from './presentation/controllers/shed.controller';

@Module({
  imports: [
    AuthModule,
    LoggerModule,
    TenantAccessModule,
    PermissionModule,
    ActivityModule,
    SubscriptionModule,
    MediaModule,
    FarmSettingsModule,
  ],
  controllers: [
    CattleController,
    BreedController,
    ShedController,
    AnimalHoldController,
  ],
  providers: [
    CattleService,
    BcsService,
    WeightService,
    CattleDetailService,
    CattleImportService,
    BreedService,
    ShedService,
    AnimalHoldService,
  ],
  exports: [
    CattleService,
    BreedService,
    ShedService,
    CattleImportService,
    AnimalHoldService,
  ],
})
export class CattleModule {}
