import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * RAKHAL-365 (MILESTONE 22) — `Purchase.supplierId`/`Payable.supplierId`/
 * `Expense.supplierId` are real `Supplier` FKs, but a Prisma FK cannot
 * express `Supplier.farmId == <document>.farmId`. Without this assert,
 * promoting the column would *open* a cross-tenant hole rather than close
 * one. Same pattern as `SaleService.assertCustomerBelongsToFarm`
 * (RAKHAL-364) — shared here because both `PurchaseService` and
 * `ExpenseService` create documents carrying a `supplierId`.
 */
export async function assertSupplierBelongsToFarm(
  client: Prisma.TransactionClient,
  farmId: string,
  supplierId: string,
): Promise<void> {
  const supplier = await client.supplier.findFirst({
    where: { id: supplierId, farmId, deletedAt: null },
    select: { id: true },
  });
  if (!supplier) {
    throw new BadRequestException('supplierId not found for this farm');
  }
}
