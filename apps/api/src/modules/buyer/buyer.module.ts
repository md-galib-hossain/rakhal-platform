import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { SalesModule } from '../sales/sales.module';
import { BuyerService } from './application/services/buyer.service';
import { BuyerController } from './presentation/controllers/buyer.controller';
import { MilkDispatchController } from './presentation/controllers/milk-dispatch.controller';
import { DispatchNumberAllocator } from './infrastructure/dispatch-number.allocator';

/**
 * RAKHAL-342 update: `FinanceModule` (V1) is no longer imported —
 * `BuyerService.recordDispatch` posts revenue through `SalesModule`'s
 * `SellMilkUseCase` now, not V1's `FinanceService.recordTransaction`. See
 * `buyer.service.ts`'s own doc comment for the full defect this replaces
 * (`FINANCE_V2_DESIGN.md` §1.2).
 */
@Module({
  imports: [
    AuthModule,
    LoggerModule,
    TenantAccessModule,
    PermissionModule,
    InventoryModule,
    SubscriptionModule,
    SalesModule,
  ],
  controllers: [BuyerController, MilkDispatchController],
  providers: [BuyerService, DispatchNumberAllocator],
  exports: [BuyerService],
})
export class BuyerModule {}
