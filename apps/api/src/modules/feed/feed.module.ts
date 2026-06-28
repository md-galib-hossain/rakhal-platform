import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { FeedConcentrationService } from './application/services/feed-concentration.service';
import { FeedGroupAssignService } from './application/services/feed-group-assign.service';
import { FeedIngredientService } from './application/services/feed-ingredient.service';
import { FeedRequirementsService } from './application/services/feed-requirements.service';
import { FeedController } from './presentation/controllers/feed.controller';

/**
 * Feed Formulator (PRD §12 / API §8). Ingredient pricing + overrides, nutritional
 * requirements, and concentration formulas. Reads `FeedGroup` (Settings) + `Cattle`
 * directly via Prisma — no cross-module service coupling (no cycles).
 */
@Module({
  imports: [AuthModule, LoggerModule, TenantAccessModule, PermissionModule],
  controllers: [FeedController],
  providers: [
    FeedIngredientService,
    FeedRequirementsService,
    FeedConcentrationService,
    FeedGroupAssignService,
  ],
  exports: [FeedIngredientService, FeedConcentrationService],
})
export class FeedModule {}
