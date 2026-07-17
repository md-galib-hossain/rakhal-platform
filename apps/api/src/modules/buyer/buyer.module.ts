import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { FinanceModule } from '../finance/finance.module';
import { BuyerService } from './application/services/buyer.service';
import { BuyerController } from './presentation/controllers/buyer.controller';
import { MilkDispatchController } from './presentation/controllers/milk-dispatch.controller';

@Module({
  imports: [
    AuthModule,
    LoggerModule,
    TenantAccessModule,
    PermissionModule,
    InventoryModule,
    SubscriptionModule,
    FinanceModule,
  ],
  controllers: [BuyerController, MilkDispatchController],
  providers: [BuyerService],
  exports: [BuyerService],
})
export class BuyerModule {}
