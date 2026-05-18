import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { SubscriptionFeatureGuard } from './guards/subscription-feature.guard';
import { SubscriptionAccessService } from './subscription-access.service';

@Module({
  imports: [LoggerModule],
  providers: [SubscriptionAccessService, SubscriptionFeatureGuard],
  exports: [SubscriptionAccessService, SubscriptionFeatureGuard],
})
export class SubscriptionModule {}
