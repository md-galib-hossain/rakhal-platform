import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { TenantAccessModule } from 'src/modules/tenant-access/tenant-access.module';
import { PermissionModule } from 'src/modules/permission/permission.module';
import { SubscriptionModule } from 'src/modules/subscription/subscription.module';
import { InventoryModule } from 'src/modules/inventory/inventory.module';
import { MilkModule } from 'src/modules/milk/milk.module';
import { FinanceV2ReceivablesModule } from 'src/modules/finance-v2/receivables/finance-v2-receivables.module';
import { FinanceV2PaymentsModule } from 'src/modules/finance-v2/payments/finance-v2-payments.module';
import { ActivityModule } from 'src/modules/activity/activity.module';
import { SaleService } from './application/sale.service';
import { SellMilkUseCase } from './application/use-cases/sell-milk/sell-milk.use-case';
import { SellInventoryUseCase } from './application/use-cases/sell-inventory/sell-inventory.use-case';
import { SaleNumberAllocator } from './infrastructure/sale-number.allocator';
import { SaleController } from './presentation/controllers/sale.controller';

/**
 * Sales module (RAKHAL-339, Phase 3 — Sales foundation, `FINANCE_V2_DESIGN.md`
 * §4.3, §5.1). New top-level module (not inside `finance-v2`) per the ticket's own
 * lane — `src/modules/inventory/` is the structural reference, `domain →
 * application → infrastructure → presentation`.
 *
 * Imports `AuthModule`/`TenantAccessModule`/`PermissionModule`/`SubscriptionModule`
 * so the controller's guard chain (JwtAuthGuard/SessionGuard/FarmContextGuard/
 * PermissionGuard/SubscriptionGuard) resolves, mirroring every Finance V2 module.
 *
 * **RAKHAL-342 update**: `SellMilkUseCase` (new, `application/use-cases/
 * sell-milk/**`) is the first sale-type use case and the first thing in this
 * module to depend on `finance-v2/**` (`ReceivableService`/`PaymentService`,
 * plus `LedgerAccountService`/`JournalService` via `FinanceV2LedgerModule`'s
 * `@Global()` registration) and on `InventoryModule` (`MilkTankService`).
 * This is exactly the one-directional edge `FINANCE_V2_DESIGN.md` §4.2
 * intends ("Sales -> Finance, never Finance -> Sales") — `finance-v2/**`
 * still imports nothing from `sales/**`.
 *
 * **RAKHAL-343 update**: also imports `MilkModule` — `SellMilkUseCase` now
 * takes a row lock on the target `MilkTank` via `MilkAvailabilityService.
 * lockAndValidate` before `MilkTankService.adjustVolume`, in the same
 * transaction. `MilkModule` imports neither `SalesModule` nor
 * `InventoryModule`'s sales-adjacent pieces, so no cycle.
 */
@Module({
  imports: [
    AuthModule,
    TenantAccessModule,
    PermissionModule,
    LoggerModule,
    SubscriptionModule,
    InventoryModule,
    MilkModule,
    FinanceV2ReceivablesModule,
    FinanceV2PaymentsModule,
    // RAKHAL-353: ActivityLogService, for SellMilkUseCase/SellInventoryUseCase's
    // new money-moving log entries (`FINANCE_V2_DESIGN.md` §1.4/§6).
    ActivityModule,
  ],
  controllers: [SaleController],
  providers: [
    SaleService,
    SaleNumberAllocator,
    SellMilkUseCase,
    SellInventoryUseCase,
  ],
  exports: [SaleService, SellMilkUseCase, SellInventoryUseCase],
})
export class SalesModule {}
