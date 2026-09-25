import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MilkModule } from '../milk/milk.module';
import { InventoryModule } from '../inventory/inventory.module';
import { FinanceV2AccountsModule } from '../finance-v2/accounts/finance-v2-accounts.module';
import { FarmSettingsModule } from '../farm-settings/farm-settings.module';
import { FeedConcentrationService } from './application/services/feed-concentration.service';
import { FeedIngredientService } from './application/services/feed-ingredient.service';
import { AuditModule } from 'src/modules/audit/audit.module';
import { FeedRequirementsService } from './application/services/feed-requirements.service';
import { FeedLookaheadService } from './application/services/feed-lookahead.service';
import { RequirementSettingsService } from './application/services/requirement-settings.service';
import { FeedDistributionService } from './application/services/feed-distribution.service';
import { FeedStockService } from './application/services/feed-stock.service';
import { FeedRationResolverService } from './application/services/feed-ration-resolver.service';
import { FeedFeedingGridService } from './application/services/feed-feeding-grid.service';
import { NutritionProfileModule } from './nutrition-profile.module';
import { ActivityModule } from '../activity/activity.module';
import { FeedController } from './presentation/controllers/feed.controller';
import { FeedPlanController } from './presentation/controllers/feed-plan.controller';
import { FeedPlanService } from './application/services/feed-plan.service';
import { FeedPlanAssignmentService } from './application/services/feed-plan-assignment.service';
import { FeedPlanResolverService } from './application/services/feed-plan-resolver.service';
import { FeedPlanAssignmentController } from './presentation/controllers/feed-plan-assignment.controller';

/**
 * Feed Formulator (PRD §12 / API §8). Ingredient pricing + overrides, nutritional
 * requirements, and concentration formulas. Reads `Cattle`
 * + `ReproductionProfile`/`Pregnancy` directly via Prisma — no cross-module service
 * coupling for those (no cycles, simple denormalized-field reads). Imports
 * `MilkModule` for one real cross-service call: `MilkService.averageDailyYield`
 * (cow-driven requirements, `FeedRequirementsService`). RAKHAL-354:
 * `FinanceModule` (V1) dropped — `FeedConcentrationService.finalize`'s TMR
 * payment now posts directly via Finance V2's `JournalService`/
 * `LedgerAccountService` (`@Global()` `FinanceV2LedgerModule`, no import
 * needed) + `FinancialAccountService` (`FinanceV2AccountsModule`, imported
 * below). RAKHAL-406: imports `InventoryModule` for one real cross-service call —
 * `FeedItemService.create` — so a Concentrate Mixer finalize can produce a real
 * inventory `FeedItem` batch (`InventoryModule` doesn't import `FeedModule`, no cycle).
 */
@Module({
  imports: [
    AuthModule,
    AuditModule,
    ActivityModule,
    NutritionProfileModule,
    LoggerModule,
    TenantAccessModule,
    PermissionModule,
    SubscriptionModule,
    MilkModule,
    InventoryModule,
    FinanceV2AccountsModule,
    FarmSettingsModule,
  ],
  controllers: [
    FeedController,
    FeedPlanController,
    FeedPlanAssignmentController,
  ],
  providers: [
    FeedIngredientService,
    FeedRequirementsService,
    FeedLookaheadService,
    RequirementSettingsService,
    FeedConcentrationService,
    FeedDistributionService,
    FeedStockService,
    FeedRationResolverService,
    FeedFeedingGridService,
    FeedPlanService,
    FeedPlanAssignmentService,
    FeedPlanResolverService,
  ],
  exports: [
    FeedIngredientService,
    RequirementSettingsService,
    FeedConcentrationService,
    FeedDistributionService,
  ],
})
export class FeedModule {}
