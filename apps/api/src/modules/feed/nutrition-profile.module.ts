import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { ActivityModule } from '../activity/activity.module';
import { FeedLotResolver } from './application/services/feed-lot-resolver.service';
import { NutritionProfileService } from './application/services/nutrition-profile.service';

/**
 * Shared home for the nutrition primitives (MILESTONE 26, RAKHAL-443/444). Split out of `FeedModule`
 * because `FeedModule` imports `InventoryModule` (Concentrate finalize → `FeedItemService`), while
 * `InventoryModule`'s `FeedItemService` now needs `NutritionProfileService` — importing `FeedModule`
 * back would be a cycle. This module depends only on Logger + Activity, so both can import it.
 */
@Module({
  imports: [LoggerModule, ActivityModule],
  providers: [FeedLotResolver, NutritionProfileService],
  exports: [FeedLotResolver, NutritionProfileService],
})
export class NutritionProfileModule {}
