import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/core/database/prisma/prisma.module';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { SettingsModule } from '../settings/settings.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CattleModule } from '../cattle/cattle.module';
import { OnboardingService } from './application/services/onboarding.service';
import { OnboardingController } from './presentation/controllers/onboarding.controller';

@Module({
  imports: [
    PrismaModule,
    LoggerModule,
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    SettingsModule,
    SubscriptionModule,
    CattleModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
