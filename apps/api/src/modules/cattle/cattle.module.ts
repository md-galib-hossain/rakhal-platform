import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { ActivityModule } from '../activity/activity.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { BcsService } from './application/services/bcs.service';
import { BreedService } from './application/services/breed.service';
import { CattleService } from './application/services/cattle.service';
import { CattleDetailService } from './application/services/cattle-detail.service';
import { CattleImportService } from './application/services/cattle-import.service';
import { ShedService } from './application/services/shed.service';
import { WeightService } from './application/services/weight.service';
import { BreedController } from './presentation/controllers/breed.controller';
import { CattleController } from './presentation/controllers/cattle.controller';
import { ShedController } from './presentation/controllers/shed.controller';

@Module({
  imports: [
    AuthModule,
    LoggerModule,
    TenantAccessModule,
    PermissionModule,
    ActivityModule,
    SubscriptionModule,
  ],
  controllers: [CattleController, BreedController, ShedController],
  providers: [
    CattleService,
    BcsService,
    WeightService,
    CattleDetailService,
    CattleImportService,
    BreedService,
    ShedService,
  ],
  exports: [CattleService, BreedService, ShedService],
})
export class CattleModule {}
