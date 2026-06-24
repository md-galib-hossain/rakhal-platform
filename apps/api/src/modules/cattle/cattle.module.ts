import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { ActivityModule } from '../activity/activity.module';
import { BreedService } from './application/services/breed.service';
import { CattleService } from './application/services/cattle.service';
import { ShedService } from './application/services/shed.service';
import { BreedController } from './presentation/controllers/breed.controller';
import { CattleController } from './presentation/controllers/cattle.controller';
import { ShedController } from './presentation/controllers/shed.controller';

@Module({
  imports: [AuthModule, LoggerModule, TenantAccessModule, ActivityModule],
  controllers: [CattleController, BreedController, ShedController],
  providers: [CattleService, BreedService, ShedService],
  exports: [CattleService, BreedService, ShedService],
})
export class CattleModule {}
