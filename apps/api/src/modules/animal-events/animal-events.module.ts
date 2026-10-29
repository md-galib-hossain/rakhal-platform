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
    FarmSettingsModule,
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    SubscriptionModule,
  ],
  controllers: [AnimalEventsController, CattleEventsController],
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
  ],
  exports: [
    EVENT_REGISTRY,
    AnimalEventTypesService,
    TimelineService,
    EligibilityService,
    EventHandlerRegistry,
  ],
})
export class AnimalEventsModule {}
