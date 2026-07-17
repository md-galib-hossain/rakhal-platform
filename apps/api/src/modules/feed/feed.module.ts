import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MilkModule } from '../milk/milk.module';
import { FeedConcentrationService } from './application/services/feed-concentration.service';
import { FeedGroupAssignService } from './application/services/feed-group-assign.service';
import { FeedIngredientService } from './application/services/feed-ingredient.service';
import { FeedRequirementsService } from './application/services/feed-requirements.service';
import { FeedDistributionService } from './application/services/feed-distribution.service';
import { FeedStockService } from './application/services/feed-stock.service';
import { FeedController } from './presentation/controllers/feed.controller';

/**
 * Feed Formulator (PRD §12 / API §8). Ingredient pricing + overrides, nutritional
 * requirements, and concentration formulas. Reads `FeedGroup` (Settings) + `Cattle`
 * + `ReproductionProfile`/`Pregnancy` directly via Prisma — no cross-module service
 * coupling for those (no cycles, simple denormalized-field reads). Imports
 * `MilkModule` for one real cross-service call: `MilkService.averageDailyYield`
 * (cow-driven requirements, `FeedRequirementsService`).
 */
@Module({
  imports: [
    AuthModule,
    LoggerModule,
    TenantAccessModule,
    PermissionModule,
    SubscriptionModule,
    MilkModule,
  ],
  controllers: [FeedController],
  providers: [
    FeedIngredientService,
    FeedRequirementsService,
    FeedConcentrationService,
    FeedGroupAssignService,
    FeedDistributionService,
    FeedStockService,
  ],
  exports: [FeedIngredientService, FeedConcentrationService],
})
export class FeedModule {}
