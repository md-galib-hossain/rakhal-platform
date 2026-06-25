import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { ActivityModule } from '../activity/activity.module';
import { BcsService } from './application/services/bcs.service';
import { BreedService } from './application/services/breed.service';
import { CattleService } from './application/services/cattle.service';
import { CattleImportService } from './application/services/cattle-import.service';
import { ShedService } from './application/services/shed.service';
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
  ],
  controllers: [CattleController, BreedController, ShedController],
  providers: [
    CattleService,
    BcsService,
    CattleImportService,
    BreedService,
    ShedService,
  ],
  exports: [CattleService, BreedService, ShedService],
})
export class CattleModule {}
