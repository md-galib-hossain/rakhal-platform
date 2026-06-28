import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { ActivityModule } from '../activity/activity.module';
import { InventoryModule } from '../inventory/inventory.module';
import { FarmSettingsModule } from '../farm-settings/farm-settings.module';
import { MilkService } from './application/services/milk.service';
import { MilkController } from './presentation/controllers/milk.controller';

@Module({
  imports: [
    AuthModule,
    LoggerModule,
    TenantAccessModule,
    PermissionModule,
    ActivityModule,
    InventoryModule,
    FarmSettingsModule,
  ],
  controllers: [MilkController],
  providers: [MilkService],
  exports: [MilkService],
})
export class MilkModule {}
