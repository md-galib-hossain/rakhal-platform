import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  FinancePayment,
  PaymentAllocation,
  PaymentDirection,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { add, gt, sum, toStorage } from 'src/common/money';
import { FinancialAccountService } from 'src/modules/finance-v2/accounts/application/financial-account.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { ReceivableService } from 'src/modules/finance-v2/receivables/application/receivable.service';
import { PayableService } from 'src/modules/purchasing/application/payable.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { CreatePaymentDto } from '../presentation/dto/create-payment.dto';
import { AllocatePaymentLineDto } from '../presentation/dto/allocate-payment.dto';

export type FinancePaymentWithAllocations = FinancePayment & {
  allocations: PaymentAllocation[];
};

/** `LedgerAccount.code` for "Accounts Receivable" — seeded by RAKHAL-333's
 * default chart (`default-chart-of-accounts.ts`). Every farm has this row
 * from bootstrap. */
const ACCOUNTS_RECEIVABLE_CODE = '1100';

/** `LedgerAccount.code` for "Accounts Payable" — same seeding as above. */
const ACCOUNTS_PAYABLE_CODE = '2000';

/**
 * Payment engine (RAKHAL-337, Finance V2 — `FINANCE_V2_DESIGN.md` §4.5, §4.6,
 * §6). One `FinancePayment` always hits exactly one `FinancialAccount`;
 * splitting a document's settlement across several accounts (cash + bKash +
 * bank) is modeled as several `FinancePayment` rows, each posting its own
 * journal entry, each with its own `PaymentAllocation` line(s).
 *
 * **Standalone-payment journal-posting judgment call** (this ticket's own
 * scoping note, `PROJECT_PROGRESS.md` RAKHAL-337): `Receivable` (RAKHAL-340)
 * and `Payable` (RAKHAL-348) do not exist yet, so a payment recorded by this
 * ticket cannot debit/credit a *specific* document's own sub-ledger row.
 * Instead every `recordPayment` posts against the **generic, already-seeded
 * system ledger accounts** `Accounts Receivable` (code `1100`, INCOMING) or
 * `Accounts Payable` (code `2000`, OUTGOING) — exactly the counterparty
 * `FINANCE_V2_DESIGN.md` §4.5's own worked example uses ("Payment received
 * MFS/bKash +4,000, Accounts Receivable −4,000"). This is not a placeholder
 * hack: in double-entry accounting there is only ever one ledger account per
 * category (AR, AP) — individual `Receivable`/`Payable` rows are sub-ledger
 * *detail* that `PaymentAllocation` (this same ticket) already tracks
 * separately. So the journal-level posting this method performs today is
 * exactly the posting a real document-attached payment will still make once
 * RAKHAL-340/348 land — those tickets only need to also write the
 * `PaymentAllocation.receivableId`/`payableId` FK (real relation) and
 * decrement that specific document's outstanding balance; the ledger
 * entries themselves do not change shape.
 *
 * `allocatePayment` is the seam RAKHAL-340/342/345/346/348 will call once a
 * real `Receivable`/`Payable` exists to settle against — its own
 * within-this-payment over-allocation guard and `PaymentAllocation` row
 * shape were already real and tested before `Receivable` existed, proven
 * with synthetic/manual reference ids (see the e2e spec's own comments).
 * **RAKHAL-340 closes the remaining gap on the receivable side**: a line
 * carrying a real `receivableId` is checked against `ReceivableService.
 * assertWithinOutstanding` — the receivable's own outstanding balance
 * across *all* its payments, not just this one — since a single payment's
 * own `amount` was never a strong enough bound once a receivable can be
 * settled by several payments over time (`FINANCE_V2_DESIGN.md` §4.5's own
 * worked example, and this ticket's own AC).
 *
 * **RAKHAL-349 mirrors the same guard on the payable side**: a line
 * carrying a real `payableId` is checked against `PayableService.
 * assertWithinOutstanding`/`closeIfSettled` — exactly the receivable-side
 * pattern above, applied to the liability side of the books (RAKHAL-348 had
 * left `PayableService.assertWithinOutstanding` written and ready but never
 * wired into this method — its own doc comment documented the gap
 * explicitly; this closes it).
 */
@Injectable()
export class PaymentService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly financialAccountService: FinancialAccountService,
    private readonly ledgerAccountService: LedgerAccountService,
    private readonly journalService: JournalService,
    private readonly receivableService: ReceivableService,
    private readonly payableService: PayableService,
    private readonly activityLog: ActivityLogService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(PaymentService.name);
  }

  /**
   * Creates the `FinancePayment` row and posts its journal entry in one
   * transaction. INCOMING debits the hit account's own ledger account and
   * credits Accounts Receivable; OUTGOING debits Accounts Payable and
   * credits the hit account's own ledger account (money leaving it). Throws
   * if the target `FinancialAccount` is archived (`assertAccountActive`) or
   * the payment amount is not strictly positive.
   */
  async recordPayment(
    farmId: string,
    userId: string,
    dto: CreatePaymentDto,
    tx?: Prisma.TransactionClient,
  ): Promise<FinancePayment> {
    const run = (client: Prisma.TransactionClient) =>
      this.recordWithClient(client, farmId, userId, dto);

    // RAKHAL-353: `recordPayment` is called two ways — standalone via
    // `POST /finance/payments` (no `tx`, this call owns its own top-level
    // transaction) and nested inside a sale/purchase/pay-supplier use case
    // (`tx` supplied, that use case owns the outer transaction and already
    // records its own higher-level ActivityLog entry, e.g. `SellMilkUseCase`
    // logs "Milk Sale Recorded"). Only the standalone path logs here —
    // logging from inside a caller-supplied, still-open `tx` would let this
    // entry commit (via `ActivityLogService.record`'s own separate
    // transaction) before the caller's outer transaction does, so a
    // mid-flow rollback in the caller could leave a "Finance Payment
    // Recorded" entry describing a payment that never actually persisted.
    if (!tx) {
      const payment = await this.prisma.$transaction((t) => run(t));
      await this.activityLog.record({
        farmId,
        module: ActivityLogModule.FINANCE,
        eventTitle: 'Finance Payment Recorded',
        actionDetails: `${dto.direction === PaymentDirection.INCOMING ? 'Received' : 'Paid'} ৳${payment.amount.toString()} via ${dto.method}.`,
        actorId: userId,
        financialImpact:
          dto.direction === PaymentDirection.INCOMING
            ? Number(payment.amount)
            : -Number(payment.amount),
      });
      return payment;
    }
    return run(tx);
  }

  private async recordWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    dto: CreatePaymentDto,
  ): Promise<FinancePayment> {
    // One account per farm: the caller no longer picks a wallet.
    const financialAccountId =
      await this.financialAccountService.resolveFarmAccountId(
        farmId,
        userId,
        dto.financialAccountId,
        client,
      );
    await this.financialAccountService.assertAccountActive(
      farmId,
      financialAccountId,
    );

    const account = await client.financialAccount.findFirst({
      where: { id: financialAccountId, farmId },
      select: { id: true, ledgerAccountId: true },
    });
    if (!account) {
      throw new NotFoundException('Financial account not found');
    }

    const amount = toStorage(dto.amount);
    if (!gt(amount, 0)) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const counterpartCode =
      dto.direction === PaymentDirection.INCOMING
        ? ACCOUNTS_RECEIVABLE_CODE
        : ACCOUNTS_PAYABLE_CODE;
    const counterpartAccount = await this.ledgerAccountService.findByCode(
      farmId,
      counterpartCode,
    );
    if (!counterpartAccount) {
      // Should never happen for a farm bootstrapped via FarmService.create
      // (RAKHAL-333 seeds this row) — defensive, not expected in practice.
      throw new BadRequestException(
        `${counterpartCode === ACCOUNTS_RECEIVABLE_CODE ? 'Accounts Receivable' : 'Accounts Payable'} ledger account is not seeded for this farm`,
      );
    }

    const payment = await client.financePayment.create({
      data: {
        farmId,
        direction: dto.direction,
        financialAccountId: account.id,
        amount,
        method: dto.method,
        transactionDate: new Date(dto.transactionDate),
        referenceNumber: dto.referenceNumber,
        notes: dto.notes,
        createdById: userId,
      },
    });

    const entries =
      dto.direction === PaymentDirection.INCOMING
        ? [
            { ledgerAccountId: account.ledgerAccountId, debit: amount },
            { ledgerAccountId: counterpartAccount.id, credit: amount },
          ]
        : [
            { ledgerAccountId: counterpartAccount.id, debit: amount },
            { ledgerAccountId: account.ledgerAccountId, credit: amount },
          ];

    await this.journalService.postJournal(
      {
        farmId,
        sourceType: 'FINANCE_PAYMENT',
        sourceId: payment.id,
        transactionDate: payment.transactionDate,
        description:
          dto.direction === PaymentDirection.INCOMING
            ? `Payment received via ${dto.method}`
            : `Payment made via ${dto.method}`,
        idempotencyKey: `finance-payment:${payment.id}`,
        createdById: userId,
        entries,
      },
      client,
    );

    this.log.info('Finance payment recorded', {
      farmId,
      paymentId: payment.id,
      direction: payment.direction,
      financialAccountId: payment.financialAccountId,
      amount: amount.toString(),
    });

    return payment;
  }

  /**
   * Creates one or more `PaymentAllocation` rows against an existing
   * `FinancePayment`, rejecting the call if the payment would become
   * over-allocated: `SUM(existing allocations) + SUM(this call's lines)`
   * must never exceed `payment.amount`. Each line must carry exactly one of
   * `receivableId`/`payableId` (application-level check — neither target
   * table exists yet to enforce this as a DB constraint, see the schema's
   * own doc comment on `PaymentAllocation`).
   */
  async allocatePayment(
    farmId: string,
    paymentId: string,
    lines: AllocatePaymentLineDto[],
    tx?: Prisma.TransactionClient,
  ): Promise<PaymentAllocation[]> {
    const run = (client: Prisma.TransactionClient) =>
      this.allocateWithClient(client, farmId, paymentId, lines);

    // RAKHAL-353: same standalone-vs-nested reasoning as `recordPayment`
    // above. Payment allocation is one of this ticket's own named
    // "sensitive" actions — logged with a `sensitive` tag on the standalone
    // path (settling a receivable/payable directly via
    // `POST /finance/payments/:id/allocate`); nested allocations (every
    // sale/pay-supplier use case) are covered by that use case's own
    // higher-level log entry.
    if (!tx) {
      const created = await this.prisma.$transaction((t) => run(t));
      const total = sum(created.map((a) => a.amount));
      await this.activityLog.record({
        farmId,
        module: ActivityLogModule.FINANCE,
        eventTitle: 'Payment Allocated',
        actionDetails: `Payment ${paymentId} allocated ৳${total.toString()} across ${created.length} line(s).`,
        // `allocatePayment` carries no `userId` param (unlike every sibling
        // method here) — not changed by this ticket, out of its "logging
        // calls only" scope to widen a signature used by 5+ call sites.
        actorId: null,
        financialImpact: Number(total),
        taggedValues: [{ key: 'sensitive', value: 'payment-allocation' }],
      });
      return created;
    }
    return run(tx);
  }

  private async allocateWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    paymentId: string,
    lines: AllocatePaymentLineDto[],
  ): Promise<PaymentAllocation[]> {
    const payment = await client.financePayment.findFirst({
      where: { id: paymentId, farmId },
      include: { allocations: true },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    for (const line of lines) {
      const hasReceivable = !!line.receivableId;
      const hasPayable = !!line.payableId;
      if (hasReceivable === hasPayable) {
        throw new BadRequestException(
          'Each allocation must set exactly one of receivableId or payableId',
        );
      }
      if (!gt(line.amount, 0)) {
        throw new BadRequestException(
          'Allocation amount must be greater than zero',
        );
      }
    }

    const alreadyAllocated = sum(payment.allocations.map((a) => a.amount));
    const newAllocated = sum(lines.map((l) => l.amount));
    const totalAfter = add(alreadyAllocated, newAllocated);
    if (gt(totalAfter, payment.amount)) {
      throw new BadRequestException(
        'Allocation total exceeds the payment amount — a payment cannot be over-allocated',
      );
    }

    const created: PaymentAllocation[] = [];
    for (const line of lines) {
      const amount = toStorage(line.amount);

      // Real cross-payment check: a `receivableId`/`payableId` line must
      // also fit within that document's own remaining outstanding balance,
      // not just this payment's amount. Re-queried on `client` before each
      // create so it reflects allocations already made earlier in this
      // same loop/transaction. `payableId` mirrors `receivableId` exactly
      // (RAKHAL-349, closing the gap RAKHAL-348 documented and left open).
      if (line.receivableId) {
        await this.receivableService.assertWithinOutstanding(
          farmId,
          line.receivableId,
          amount,
          client,
        );
      } else if (line.payableId) {
        await this.payableService.assertWithinOutstanding(
          farmId,
          line.payableId,
          amount,
          client,
        );
      }

      const row = await client.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          receivableId: line.receivableId ?? null,
          payableId: line.payableId ?? null,
          amount,
        },
      });
      created.push(row);

      if (line.receivableId) {
        await this.receivableService.closeIfSettled(
          farmId,
          line.receivableId,
          client,
        );
      } else if (line.payableId) {
        await this.payableService.closeIfSettled(
          farmId,
          line.payableId,
          client,
        );
      }
    }

    this.log.info('Payment allocated', {
      farmId,
      paymentId: payment.id,
      lines: created.length,
      totalAllocated: totalAfter.toString(),
    });

    return created;
  }

  async findOne(
    farmId: string,
    id: string,
  ): Promise<FinancePaymentWithAllocations> {
    const payment = await this.prisma.financePayment.findFirst({
      where: { id, farmId },
      include: { allocations: true },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async findAll(farmId: string): Promise<FinancePayment[]> {
    return this.prisma.financePayment.findMany({
      where: { farmId },
      orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
    });
  }
}
