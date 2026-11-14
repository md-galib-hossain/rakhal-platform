import { ApiProperty } from '@nestjs/swagger';
import {
  FinancialAccountType,
  MfsProvider,
  PaymentDirection,
  PaymentMethod,
  type Prisma,
} from '@prisma/client';
import type { CursorPage } from 'src/common/pagination/cursor-page.type';
import type { BalanceService } from '../../accounts/application/balance.service';
import type { FinancialAccountService } from '../../accounts/application/financial-account.service';
import type { IncomeService } from '../../income/application/income.service';
import type { PaymentService } from '../../payments/application/payment.service';
import { ReceivableStatus } from '../../receivables/domain/receivable-status';
import type { ReceivableService } from '../../receivables/application/receivable.service';
import type { TransferService } from '../../transfers/application/transfer.service';

/**
 * Documented response shapes for the finance-v2 routes typed under RD-140. Each class mirrors what the
 * service really returns and is pinned to it by a compile-time guard at the bottom of this file, so a change
 * in a service (or a Prisma column) fails `nest build` until this file follows.
 *
 * On the wire: `Date` fields are ISO-8601 strings and every money field (`Prisma.Decimal`) is a decimal
 * string, never a JSON number.
 *
 * Not documented here: `POST /finance/transfers`. It always throws 409 ("Transfers are disabled: each farm
 * has a single financial account"), so it has no success response.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;
const MONEY = {
  type: String,
  description: 'Decimal amount as a string (never a JSON number).',
} as const;

// ─── Financial accounts ────────────────────────────────────────────────────

export class BankAccountDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty() financialAccountId!: string;
  @ApiProperty() bankName!: string;
  @ApiProperty() accountNumber!: string;
  @ApiProperty({ type: String, nullable: true }) branch!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

export class MfsAccountDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty() financialAccountId!: string;
  @ApiProperty({ enum: MfsProvider, enumName: 'MfsProvider' })
  provider!: MfsProvider;
  @ApiProperty() phoneNumber!: string;
  @ApiProperty({ type: String, nullable: true }) accountType!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

export class FinancialAccountResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty({
    enum: FinancialAccountType,
    enumName: 'FinancialAccountType',
  })
  type!: FinancialAccountType;
  @ApiProperty() ledgerAccountId!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() isPrimary!: boolean;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deletedAt!: Date | null;
  @ApiProperty() createdById!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
  @ApiProperty({ type: () => BankAccountDetailDto, nullable: true })
  bankDetail!: BankAccountDetailDto | null;
  @ApiProperty({ type: () => MfsAccountDetailDto, nullable: true })
  mfsDetail!: MfsAccountDetailDto | null;
}

// ─── Balance ───────────────────────────────────────────────────────────────

export class AccountBalanceDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({
    enum: FinancialAccountType,
    enumName: 'FinancialAccountType',
  })
  type!: FinancialAccountType;
  @ApiProperty(MONEY) balance!: Prisma.Decimal;
}

export class BalanceBreakdownDto {
  @ApiProperty(MONEY) cash!: Prisma.Decimal;
  @ApiProperty(MONEY) bank!: Prisma.Decimal;
  @ApiProperty(MONEY) mfs!: Prisma.Decimal;
}

export class RakhalBalanceResponseDto {
  @ApiProperty(MONEY) rakhalBalance!: Prisma.Decimal;
  @ApiProperty({ type: () => BalanceBreakdownDto })
  breakdown!: BalanceBreakdownDto;
  @ApiProperty({ type: () => [AccountBalanceDto] })
  accounts!: AccountBalanceDto[];
}

// ─── Income ────────────────────────────────────────────────────────────────

export class IncomeCategoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isSystem!: boolean;
  @ApiProperty({ type: String, nullable: true }) farmId!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
}

export class IncomeResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty(MONEY) amount!: Prisma.Decimal;
  @ApiProperty(DATE_TIME) date!: Date;
  @ApiProperty() financialAccountId!: string;
  @ApiProperty() createdById!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
}

// ─── Payments ──────────────────────────────────────────────────────────────

export class PaymentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty(MONEY) amount!: Prisma.Decimal;
  @ApiProperty({ enum: PaymentDirection, enumName: 'PaymentDirection' })
  direction!: PaymentDirection;
  @ApiProperty() financialAccountId!: string;
  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  method!: PaymentMethod;
  @ApiProperty(DATE_TIME) transactionDate!: Date;
  @ApiProperty({ type: String, nullable: true })
  referenceNumber!: string | null;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty() createdById!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
}

export class PaymentAllocationDto {
  @ApiProperty() id!: string;
  @ApiProperty() paymentId!: string;
  @ApiProperty({ type: String, nullable: true })
  receivableId!: string | null;
  @ApiProperty({ type: String, nullable: true }) payableId!: string | null;
  @ApiProperty(MONEY) amount!: Prisma.Decimal;
  @ApiProperty(DATE_TIME) createdAt!: Date;
}

export class PaymentWithAllocationsResponseDto extends PaymentResponseDto {
  @ApiProperty({ type: () => [PaymentAllocationDto] })
  allocations!: PaymentAllocationDto[];
}

// ─── Receivables ───────────────────────────────────────────────────────────

export class ReceivableResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() saleId!: string;
  @ApiProperty({ type: String, nullable: true }) customerId!: string | null;
  @ApiProperty(MONEY) totalAmount!: Prisma.Decimal;
  @ApiProperty({ ...DATE_TIME, nullable: true }) dueDate!: Date | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) closedAt!: Date | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty({
    type: String,
    description:
      'Computed from the payment allocations on every read, never stored. Decimal string.',
  })
  outstanding!: string;
  @ApiProperty({ enum: ReceivableStatus, enumName: 'ReceivableStatus' })
  status!: ReceivableStatus;
}

// ─── Transfers (read-only: creation is disabled) ───────────────────────────

export class TransferResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() fromFinancialAccountId!: string;
  @ApiProperty() toFinancialAccountId!: string;
  @ApiProperty(MONEY) amount!: Prisma.Decimal;
  @ApiProperty(MONEY) feeAmount!: Prisma.Decimal;
  @ApiProperty(DATE_TIME) transactionDate!: Date;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty() createdById!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
// Each fails `nest build` if the service's real return type and the documented class diverge.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Ret<S, K extends keyof S> = S[K] extends (...args: never[]) => infer R
  ? Awaited<R>
  : never;

type Acct = FinancialAccountService;
type Inc = IncomeService;
type Pay = PaymentService;
type Rec = ReceivableService;

export type FinanceShapeGuards = [
  Assert<Same<Ret<Acct, 'createAccount'>, FinancialAccountResponseDto>>,
  Assert<Same<Ret<Acct, 'findOne'>, FinancialAccountResponseDto>>,
  Assert<Same<Ret<Acct, 'resolveFarmAccount'>, FinancialAccountResponseDto>>,
  Assert<Same<Ret<Acct, 'updateAccount'>, FinancialAccountResponseDto>>,
  Assert<Same<Ret<Acct, 'setOpeningBalance'>, FinancialAccountResponseDto>>,
  Assert<Same<Ret<Acct, 'setPrimary'>, FinancialAccountResponseDto>>,
  Assert<Same<Ret<Acct, 'archiveAccount'>, FinancialAccountResponseDto>>,
  Assert<Same<Ret<Acct, 'findAll'>, FinancialAccountResponseDto[]>>,
  Assert<
    Same<Ret<BalanceService, 'getRakhalBalance'>, RakhalBalanceResponseDto>
  >,
  Assert<Same<Ret<Inc, 'createCategory'>, IncomeCategoryResponseDto>>,
  Assert<Same<Ret<Inc, 'listCategories'>, IncomeCategoryResponseDto[]>>,
  Assert<Same<Ret<Inc, 'recordOtherIncome'>, IncomeResponseDto>>,
  Assert<Same<Ret<Inc, 'findOne'>, IncomeResponseDto>>,
  Assert<Same<Ret<Inc, 'findAll'>, IncomeResponseDto[]>>,
  Assert<Same<Ret<Pay, 'recordPayment'>, PaymentResponseDto>>,
  Assert<Same<Ret<Pay, 'findAll'>, PaymentResponseDto[]>>,
  Assert<Same<Ret<Pay, 'findOne'>, PaymentWithAllocationsResponseDto>>,
  Assert<Same<Ret<Pay, 'allocatePayment'>, PaymentAllocationDto[]>>,
  Assert<Same<Ret<Rec, 'findOne'>, ReceivableResponseDto>>,
  Assert<Same<Ret<Rec, 'listReceivables'>, CursorPage<ReceivableResponseDto>>>,
  Assert<Same<Ret<TransferService, 'findAll'>, TransferResponseDto[]>>,
  Assert<Same<Ret<TransferService, 'findOne'>, TransferResponseDto>>,
];
