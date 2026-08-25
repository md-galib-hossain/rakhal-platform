import { PaymentMethod } from '@prisma/client';

/**
 * Input to `PaySupplierUseCase.execute` (RAKHAL-349, Purchasing —
 * `FINANCE_V2_DESIGN.md` §1.4). Plain interface, not a class-validator
 * `Dto` — same no-HTTP-route judgment call `RecordManureSaleUseCase`
 * (RAKHAL-347) and `SellInventoryUseCase` (RAKHAL-346) already document:
 * this ticket's own Lane is `application/use-cases/**` only, a controller
 * is a later frontend-facing ticket's job (RAKHAL-357/359). Every field is
 * validated by hand inside the use case itself.
 */
export interface PaySupplierInput {
  payableId: string;
  financialAccountId: string;
  amount: number;
  method: PaymentMethod;
  transactionDate: string;
  referenceNumber?: string;
}
