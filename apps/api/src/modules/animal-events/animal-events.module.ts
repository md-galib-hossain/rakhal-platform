import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { EventRegistry } from './domain/event-registry';
import {
  AnimalEventTypesService,
  EVENT_REGISTRY,
} from './application/services/animal-event-types.service';
import { FarmSettingsModule } from '../farm-settings/farm-settings.module';
import { EligibilityService } from './application/services/eligibility.service';
import { AnimalEventWriteService } from './application/services/animal-event-write.service';
import { EventHandlerRegistry } from './application/event-handler';
import { TaskModule } from '../task/task.module';
import { ActivityModule } from '../activity/activity.module';
import { AnimalEventEditService } from './application/services/animal-event-edit.service';
import { CustomEventTypeService } from './application/services/custom-event-type.service';
import { CustomTypesController } from './presentation/controllers/custom-types.controller';
import { AnimalEventAnchorChecker } from './application/anchors/animal-event-anchor.checker';
import { FollowUpService } from './application/services/follow-up.service';
import { BulkEventService } from './application/services/bulk-event.service';
import { NotificationModule } from '../notification/notification.module';
import { FarmTimeModule } from 'src/common/farm-time/farm-time.module';
import { FollowUpRulesController } from './presentation/controllers/follow-up-rules.controller';
import { TimelineService } from './application/services/timeline.service';
import { AnimalEventsController } from './presentation/controllers/animal-events.controller';
import { CattleEventsController } from './presentation/controllers/cattle-events.controller';

/**
 * Animal Events (MILESTONE 31 "Events Core", RAKHAL-478): event catalogue +
 * registry core. No imports from domain modules (reproduction, health, ...):
 * those register their handlers here in later tickets.
 */
@Module({
  imports: [
    LoggerModule,
    ActivityModule,
    TaskModule,
    FarmSettingsModule,
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    SubscriptionModule,
    NotificationModule,
    FarmTimeModule,
  ],
  controllers: [
    AnimalEventsController,
    CattleEventsController,
    FollowUpRulesController,
    CustomTypesController,
  ],
  providers: [
    {
      provide: EVENT_REGISTRY,
      useFactory: () => EventRegistry.withCatalogue(),
    },
    AnimalEventTypesService,
    TimelineService,
    EligibilityService,
    EventHandlerRegistry,
    AnimalEventWriteService,
    FollowUpService,
    CustomEventTypeService,
    AnimalEventEditService,
    BulkEventService,
    AnimalEventAnchorChecker,
  ],
  exports: [
    EVENT_REGISTRY,
    AnimalEventTypesService,
    TimelineService,
    EligibilityService,
    EventHandlerRegistry,
    AnimalEventWriteService,
    FollowUpService,
  ],
})
export class AnimalEventsModule {}
