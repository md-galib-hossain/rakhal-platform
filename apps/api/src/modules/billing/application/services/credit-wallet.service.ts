import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  CreditSpendSurface,
  DEFAULT_CREDIT_POLICY,
} from '../../domain/credit-policy';

/** Prisma client or an interactive-transaction client — so a caller can run a
 * credit movement inside its own atomic transaction (e.g. checkout). */
type Db = PrismaService | Prisma.TransactionClient;

/**
 * Rakhal Credit wallet (PRD §37) — the **shared primitive** for the closed-loop
 * `CreditWallet` balance. Referrals *credit* it (RAKHAL-223); billing checkout
 * *debits* it. It is deliberately **not owned by the referral module** so that
 * future paid surfaces — Rakhal Doctors (§38.1), Marketplace (§38.2), Cattle
 * Trading (§38.3) — spend credit with a one-line `debit(...)` call and zero
 * wallet rework. Cash-out is gated by `assertCashOutEnabled` against the
 * configurable `DEFAULT_CREDIT_POLICY` (CRD-05).
 *
 * Distinct from the Finance cash wallet (`WalletTransaction`): that is real
 * money; this is store credit.
 */
@Injectable()
export class CreditWalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(
    farmId: string,
    db: Db = this.prisma,
  ): Promise<Prisma.Decimal> {
    const wallet = await db.creditWallet.findUnique({ where: { farmId } });
    return wallet?.balance ?? new Prisma.Decimal(0);
  }

  /** Add credit (idempotency/dedupe is the caller's concern). Upserts the wallet. */
  async credit(
    farmId: string,
    amount: Prisma.Decimal,
    db: Db = this.prisma,
  ): Promise<void> {
    if (amount.lte(0)) return;
    await db.creditWallet.upsert({
      where: { farmId },
      create: { farmId, balance: amount },
      update: { balance: { increment: amount } },
    });
  }

  /**
   * Remove credit. `allowNegative` lets a clawback (REF-05) net against future
   * earnings instead of demanding money back — never used for a spend, where
   * the amount is always ≤ balance. Idempotency/authorization are the caller's.
   */
  async debit(
    farmId: string,
    amount: Prisma.Decimal,
    opts: { allowNegative?: boolean; db?: Db } = {},
  ): Promise<void> {
    const db = opts.db ?? this.prisma;
    if (amount.lte(0)) return;
    await db.creditWallet.update({
      where: { farmId },
      data: { balance: { decrement: amount } },
    });
  }

  /**
   * Apply up to the wallet balance against a `remaining` charge, atomically
   * inside the caller's transaction (`tx`). Returns the amount actually applied
   * — never more than the balance or the remaining charge, so a total can reach
   * ৳0 but never go negative (CRD-02). This is the single entry point every
   * spend surface uses; `subscription` calls it from checkout today, and future
   * surfaces (Doctors/Marketplace/Cattle-Trade, §38) call it the same way.
   *
   * The `surface` is validated against `DEFAULT_CREDIT_POLICY.spendableSurfaces`
   * (CRD-03), so a not-yet-enabled surface can't silently accept credit — a
   * surface only becomes spendable once the owner adds it to the policy.
   */
  async applyToCharge(
    tx: Prisma.TransactionClient,
    farmId: string,
    remaining: Prisma.Decimal,
    surface: CreditSpendSurface = 'subscription',
  ): Promise<Prisma.Decimal> {
    if (!DEFAULT_CREDIT_POLICY.spendableSurfaces.includes(surface)) {
      throw new ForbiddenException(
        `Rakhal Credit cannot yet be spent on "${surface}"`,
      );
    }
    const wallet = await tx.creditWallet.findUnique({ where: { farmId } });
    if (!wallet || wallet.balance.lte(0) || remaining.lte(0)) {
      return new Prisma.Decimal(0);
    }
    const applied = wallet.balance.gt(remaining) ? remaining : wallet.balance;
    await tx.creditWallet.update({
      where: { farmId },
      data: { balance: { decrement: applied } },
    });
    return applied;
  }

  /**
   * The one gate every future cash-out/withdrawal path must call. Throws while
   * the policy keeps credit closed-loop (CRD-05) — flipping
   * `DEFAULT_CREDIT_POLICY.cashOutEnabled` (plus building the payout rails,
   * RD-018) is the whole switch.
   */
  assertCashOutEnabled(): void {
    if (!DEFAULT_CREDIT_POLICY.cashOutEnabled) {
      throw new ForbiddenException(
        'Rakhal Credit is store credit and cannot be withdrawn as cash',
      );
    }
  }
}
