import { PaymentMethod } from '@prisma/client';

/**
 * Input to {@link SellAnimalUseCase.execute} (RAKHAL-345, Sales — atomic
 * `SellAnimal` use case, `FINANCE_V2_DESIGN.md` §1.1, §4.2). Plain TS
 * interface (validated by the presentation-layer DTO once RAKHAL-357 wires a
 * real HTTP route — this ticket's scope is the use case itself, called
 * directly, same precedent RAKHAL-344's `RecordCattleDispositionInput`
 * established).
 */
export interface SellAnimalInput {
  /** Sale price for this one animal — required, > 0. */
  salePrice: number;
  /** Counterparty — plain string, same judgment call `Sale.customerId`
   * documents (no generic `Customer` entity exists yet). Prefer `buyerId`
   * over `buyerName` when both are given. */
  buyerName?: string;
  buyerId?: string;
  /** Required together with `paymentMethod` whenever `amountReceived > 0`. */
  financialAccountId?: string;
  paymentMethod?: PaymentMethod;
  /** Amount collected now, <= `salePrice`. Omitted/0 leaves the full amount
   * outstanding on the `Receivable`. */
  amountReceived?: number;
  saleDate: string;
}

/** Result of a successful {@link SellAnimalUseCase.execute} call. */
export interface SellAnimalResult {
  saleId: string;
  saleNumber: string;
  totalAmount: string;
  dispositionId: string;
  receivableId: string;
  paymentId: string | null;
  journalTransactionId: string;
}
