import { Module, forwardRef } from '@nestjs/common';
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
import { CattleEventHandler } from './application/events/cattle-events.handler';
import { AnimalEventsModule } from '../animal-events/animal-events.module';
// RAKHAL-307: CattleService.create() needs ReproductionDerivationService to
// end intake with the same refreshDerivedState() recompute every other
// reproduction write uses. ReproductionModule already imports CattleModule
// (AnimalHoldService), so this direction is a real cycle — forwardRef() on
// both sides (see reproduction.module.ts's own updated comment).
import { ReproductionModule } from '../reproduction/reproduction.module';
import { TaskModule } from '../task/task.module';
import { AnimalHoldService } from './application/services/animal-hold.service';
import { AnimalUpcomingEventsService } from './application/services/animal-upcoming-events.service';
import { BcsService } from './application/services/bcs.service';
import { BreedService } from './application/services/breed.service';
import { CattleService } from './application/services/cattle.service';
import { CattleDetailService } from './application/services/cattle-detail.service';
import { CattleImportService } from './application/services/cattle-import.service';
import { AnimalGroupService } from './application/services/animal-group.service';
import { ShedService } from './application/services/shed.service';
import { WeightService } from './application/services/weight.service';
import { AnimalHoldController } from './presentation/controllers/animal-hold.controller';
import { BreedController } from './presentation/controllers/breed.controller';
import { CattleController } from './presentation/controllers/cattle.controller';
import { AnimalGroupController } from './presentation/controllers/animal-group.controller';
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
    AnimalEventsModule,
    forwardRef(() => ReproductionModule),
    TaskModule,
  ],
  controllers: [
    CattleController,
    BreedController,
    ShedController,
    AnimalGroupController,
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
    AnimalGroupService,
    AnimalHoldService,
    // RAKHAL-475: per-animal upcoming events for the list column + `GET /cattle/:id/upcoming-events`.
    // `FarmClockService` comes from the global `FarmTimeModule`.
    AnimalUpcomingEventsService,
    // RAKHAL-481: WEIGHT / BCS handler for `POST /cattle/:id/events`.
    CattleEventHandler,
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
