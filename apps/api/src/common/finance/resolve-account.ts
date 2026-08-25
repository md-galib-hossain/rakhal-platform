import { BadRequestException } from '@nestjs/common';
import { FinancialAccountType, PaymentMethod } from '@prisma/client';
import type { PrismaService } from 'src/core/database/prisma/prisma.service';

const METHOD_TO_ACCOUNT_TYPE: Record<PaymentMethod, FinancialAccountType> = {
  [PaymentMethod.CASH]: FinancialAccountType.CASH,
  [PaymentMethod.BANK_TRANSFER]: FinancialAccountType.BANK,
  [PaymentMethod.MFS]: FinancialAccountType.MFS,
};

/**
 * RAKHAL-354 stopgap: resolves a farmer's `PaymentMethod` choice (CASH/
 * BANK_TRANSFER/MFS — a payment *method*, not an account) to one concrete
 * `FinancialAccount` of the matching type, for call sites that migrated off
 * V1's `FinancePaymentMethod` (which included `WALLET`, an implicit
 * accountless bucket) but don't yet have a real `AccountPicker` in their own
 * frontend form — `ReproductionService`/`ReproductionEditService`'s
 * breeding-cost posting and `FeedConcentrationService.finalize`'s TMR
 * payment. Both frontend forms currently submit a bare `paymentMethod`
 * string (confirmed via `lib/types/payment.ts`'s own doc comment — neither
 * form was migrated onto the new WALLET-less canonical type before this
 * ticket, since the V1 route they posted against didn't exist to migrate
 * onto yet), so this picks the farm's oldest active account of the matching
 * type rather than requiring a `financialAccountId` the caller can't yet
 * supply.
 *
 * **Known limitation, filed as new tech debt** (`docs/TECH_DEBT.md`): this
 * silently picks *a* CASH/BANK/MFS account, not *the* one the farmer
 * intended, on farms with more than one account of the same type. A future
 * ticket should replace both call sites' `paymentMethod` field with a real
 * `financialAccountId` (`AccountPicker`, matching every other V2 money-
 * movement form) and delete this helper.
 *
 * Throws `BadRequestException` for `WALLET` (deleted in V2, `FINANCE_V2_DESIGN.md`
 * §3) or when the farm has no active account of the resolved type.
 */
export async function resolveFinancialAccountId(
  prisma: PrismaService,
  farmId: string,
  paymentMethod: PaymentMethod,
): Promise<string> {
  const accountType = METHOD_TO_ACCOUNT_TYPE[paymentMethod];
  if (!accountType) {
    throw new BadRequestException(
      `Unsupported payment method '${String(paymentMethod)}' — WALLET was removed in Finance V2; pick CASH, BANK_TRANSFER or MFS.`,
    );
  }
  const account = await prisma.financialAccount.findFirst({
    where: { farmId, type: accountType, isActive: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (!account) {
    throw new BadRequestException(
      `No active ${accountType} financial account exists for this farm — create one under Finance > Accounts before recording this cost.`,
    );
  }
  return account.id;
}
