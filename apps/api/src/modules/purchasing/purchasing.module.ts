import { forwardRef, Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { TenantAccessModule } from 'src/modules/tenant-access/tenant-access.module';
import { PermissionModule } from 'src/modules/permission/permission.module';
import { SubscriptionModule } from 'src/modules/subscription/subscription.module';
import { FinanceV2AccountsModule } from 'src/modules/finance-v2/accounts/finance-v2-accounts.module';
import { FinanceV2PaymentsModule } from 'src/modules/finance-v2/payments/finance-v2-payments.module';
import { InventoryModule } from 'src/modules/inventory/inventory.module';
import { ActivityModule } from 'src/modules/activity/activity.module';
import { PurchaseService } from './application/purchase.service';
import { ExpenseService } from './application/expense.service';
import { PayableService } from './application/payable.service';
import { PaySupplierUseCase } from './application/use-cases/pay-supplier/pay-supplier.use-case';
import { PurchaseNumberAllocator } from './infrastructure/purchase-number.allocator';
import { PurchaseController } from './presentation/controllers/purchase.controller';
import { ExpenseController } from './presentation/controllers/expense.controller';
import { PayableController } from './presentation/controllers/payable.controller';

/**
 * Purchasing module (RAKHAL-348, Phase 4-8 — Purchasing, `FINANCE_V2_DESIGN.md`
 * §4.3, §5.1). New top-level module (not inside `finance-v2`), same
 * structural choice `SalesModule` made — `src/modules/inventory/` is the
 * structural reference, `domain → application → infrastructure →
 * presentation`.
 *
 * `FinanceV2LedgerModule` (`LedgerAccountService`/`JournalService`) is
 * `@Global()` so it resolves without an import here, same as every other
 * Finance V2-adjacent module. `FinanceV2AccountsModule` is imported directly
 * for `FinancialAccountService.assertAccountActive` (both `PurchaseService`
 * and `ExpenseService` validate the paying account before posting).
 * `InventoryModule` is imported directly so `PurchaseService` can call
 * `MedicineService`/`FeedItemService`/`EquipmentService.adjustStock`
 * (RAKHAL-341's `tx` seam) to atomically increment real stock — the physical
 * half of "a Purchase increases an inventory asset", alongside the ledger
 * posting.
 *
 * `FinanceV2PaymentsModule` is imported (RAKHAL-349) so the new
 * `PaySupplierUseCase` can call `PaymentService.recordPayment`/
 * `allocatePayment` — wrapped in `forwardRef()` because
 * `FinanceV2PaymentsModule` imports this module back (for `PayableService`,
 * the mirror-image guard `allocatePayment` now calls for `payableId`
 * lines), a genuine circular module reference Nest resolves lazily.
 */
@Module({
  imports: [
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    LoggerModule,
    SubscriptionModule,
    FinanceV2AccountsModule,
    InventoryModule,
    forwardRef(() => FinanceV2PaymentsModule),
    // RAKHAL-353: ActivityLogService for the new money-moving log entries
    // (PurchaseService/ExpenseService/PaySupplierUseCase).
    ActivityModule,
  ],
  controllers: [PurchaseController, ExpenseController, PayableController],
  providers: [
    PurchaseService,
    ExpenseService,
    PayableService,
    PurchaseNumberAllocator,
    PaySupplierUseCase,
  ],
  exports: [
    PurchaseService,
    ExpenseService,
    PayableService,
    PaySupplierUseCase,
  ],
})
export class PurchasingModule {}
