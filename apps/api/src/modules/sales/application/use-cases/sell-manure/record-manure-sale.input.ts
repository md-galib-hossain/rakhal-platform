import { PaymentMethod } from '@prisma/client';

/**
 * Input to `RecordManureSaleUseCase.execute` (RAKHAL-347, `FINANCE_V2_DESIGN.md`
 * §2.1, RD-058). Plain interface, not a class-validator `Dto` — this ticket adds
 * **no HTTP route** (its Lane is `application/use-cases/sell-manure/**` only; a
 * controller is a later frontend-facing ticket's job, RAKHAL-357). Every field is
 * validated by hand inside the use case itself, the same convention
 * `ReceivableService.createReceivable`/`PaymentService.recordPayment` already use
 * for their own non-HTTP-DTO inputs.
 *
 * `quantity`/`unitId` are **deliberately optional** — RD-058: Rakhal has no manure
 * production/stock model, so it never pretends to know how much manure exists or
 * validates a sale against it. `totalAmount` is the only required money figure.
 *
 * `paymentMethod` is **not** in the ticket's own dto sketch but is required by
 * `CreatePaymentDto.method` once `amountReceived > 0` — a judgment call, documented
 * on `RecordManureSaleUseCase.execute`: defaults to `CASH` when omitted, mirroring
 * how a manure sale is typically settled on the spot.
 */
export interface RecordManureSaleInput {
  quantity?: number;
  unitId?: string;
  totalAmount: number;
  financialAccountId?: string;
  amountReceived?: number;
  paymentMethod?: PaymentMethod;
  saleDate: string;
  notes?: string;
}
