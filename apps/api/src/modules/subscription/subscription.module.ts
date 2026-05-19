import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { SubscriptionAccessService } from './application/services/subscription-access.service';
import { SubscriptionFeatureGuard } from './presentation/guards/subscription-feature.guard';

@Module({
  imports: [LoggerModule],
  providers: [SubscriptionAccessService, SubscriptionFeatureGuard],
  exports: [SubscriptionAccessService, SubscriptionFeatureGuard],
})
export class SubscriptionModule {}
