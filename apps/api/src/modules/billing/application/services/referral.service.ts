import { ConflictException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  AuditAction,
  CommissionStatus,
  Prisma,
  ReferralCommission,
  ReferralStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AuditService } from 'src/modules/audit/application/services/audit.service';
import { DEFAULT_REFERRAL_PROGRAM } from '../../domain/referral-program';
import { CreditWalletService } from './credit-wallet.service';

export interface ReferralSummary {
  code: string;
  active: boolean;
  wallet_balance: number;
  referred_farms: {
    farm_id: string;
    status: ReferralStatus;
    flagged: boolean;
    bound_at: string;
    qualified_at: string | null;
  }[];
}

/**
 * Referral engine (RAKHAL-223, PRD §33.2). Attribution (REF-01) happens once
 * at farm creation via `bindReferral`. Reward accrual (REF-02/03) happens on
 * the referred farm's first real (non-৳0) paid invoice via
 * `accrueOnFirstPaidInvoice`, called from `BillingService.finalizePayment`.
 * Credit auto-applies at every checkout via `applyWalletCredit`, run inside
 * `BillingService.checkout`'s transaction. `clawback` (REF-05) reverses an
 * accrual when its triggering invoice is refunded. Program parameters
 * (REF-08) are the seam in `domain/referral-program.ts` — no platform-admin
 * HTTP surface yet (RD-025-style deferral, `PlatformAdminGuard` lands in
 * RAKHAL-224/225).
 */
@Injectable()
export class ReferralService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly creditWallet: CreditWalletService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReferralService.name);
  }

  /** Lazily creates the farm's one active referral code. */
  async getOrCreateCode(farmId: string, userId: string) {
    const existing = await this.prisma.referralCode.findFirst({
      where: { farmId, active: true },
    });
    if (existing) return existing;

    const code = await this.uniqueCode();
    return this.prisma.referralCode.create({
      data: { farmId, ownerUserId: userId, code },
    });
  }

  /**
   * REF-01 — bind a referral **once, permanently** at farm creation. Best-effort:
   * an unknown/inactive code, or any error, must never block farm creation
   * (the caller wraps this in try/catch).
   */
  async bindReferral(
    referredFarmId: string,
    referredOwnerUserId: string,
    code: string,
  ): Promise<void> {
    const referralCode = await this.prisma.referralCode.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (!referralCode || !referralCode.active) return;

    // REF-04: a farm cannot refer itself.
    const isSelfReferral = referralCode.ownerUserId === referredOwnerUserId;

    const windowStart = new Date(
      Date.now() -
        DEFAULT_REFERRAL_PROGRAM.velocityWindowHours * 60 * 60 * 1000,
    );
    const recentCount = await this.prisma.referral.count({
      where: { referralCodeId: referralCode.id, boundAt: { gte: windowStart } },
    });
    const flagged =
      !isSelfReferral &&
      recentCount >= DEFAULT_REFERRAL_PROGRAM.velocityCapPerWindow;

    try {
      await this.prisma.referral.create({
        data: {
          referralCodeId: referralCode.id,
          referrerFarmId: referralCode.farmId,
          referredFarmId,
          status: isSelfReferral ? ReferralStatus.VOID : ReferralStatus.PENDING,
          flagged,
          flagReason: isSelfReferral
            ? 'self-referral'
            : flagged
              ? 'velocity cap exceeded'
              : null,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Already bound (or attempted) for this farm — first-touch, permanent.
        return;
      }
      throw err;
    }

    await this.audit.record({
      actorUserId: referredOwnerUserId,
      action: AuditAction.REFERRAL_BOUND,
      entityType: 'Referral',
      entityId: referredFarmId,
      farmId: referredFarmId,
      metadata: {
        referrerFarmId: referralCode.farmId,
        selfReferral: isSelfReferral,
        flagged,
      },
    });
  }

  /**
   * REF-02/03/06 — accrue a commission on the referred farm's first real
   * (non-৳0) paid invoice. Idempotent on `triggerInvoiceId`. Never throws —
   * a failure here must not fail the payment finalize it's called from.
   * Launch kill switch: while `DEFAULT_REFERRAL_PROGRAM.creditingEnabled`
   * is false, the commission row is still recorded but always lands
   * `PENDING` (no wallet credit) — same path as a flagged/held referral.
   */
  async accrueOnFirstPaidInvoice(
    farmId: string,
    invoiceId: string,
  ): Promise<void> {
    try {
      const referral = await this.prisma.referral.findUnique({
        where: { referredFarmId: farmId },
      });
      if (!referral || referral.status === ReferralStatus.VOID) return;

      // REF-02: only the farm's first-ever real (total > 0) paid invoice qualifies.
      const priorPaid = await this.prisma.invoice.findFirst({
        where: {
          farmId,
          status: 'PAID',
          total: { gt: 0 },
          id: { not: invoiceId },
        },
        select: { id: true },
      });
      if (priorPaid) return;

      const approve =
        DEFAULT_REFERRAL_PROGRAM.creditingEnabled && !referral.flagged;
      let commission: ReferralCommission;
      try {
        commission = await this.prisma.referralCommission.create({
          data: {
            referrerFarmId: referral.referrerFarmId,
            referredFarmId: farmId,
            triggerInvoiceId: invoiceId,
            amount: DEFAULT_REFERRAL_PROGRAM.rewardAmount,
            status: approve
              ? CommissionStatus.APPROVED
              : CommissionStatus.PENDING,
            idempotencyKey: invoiceId,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          return; // already accrued for this invoice (REF-06)
        }
        throw err;
      }

      if (approve) {
        await this.prisma.$transaction(async (tx) => {
          await this.creditWallet.credit(
            referral.referrerFarmId,
            commission.amount,
            tx,
          );
          await tx.referral.update({
            where: { id: referral.id },
            data: {
              status: ReferralStatus.REWARDED,
              qualifiedAt: new Date(),
            },
          });
        });
      } else {
        await this.prisma.referral.update({
          where: { id: referral.id },
          data: { status: ReferralStatus.QUALIFIED, qualifiedAt: new Date() },
        });
      }

      const referrerOwnerId = await this.farmOwnerId(referral.referrerFarmId);
      await this.audit.record({
        actorUserId: referrerOwnerId ?? referral.referrerFarmId,
        action: AuditAction.REFERRAL_COMMISSION_ACCRUED,
        entityType: 'ReferralCommission',
        entityId: commission.id,
        farmId: referral.referrerFarmId,
        metadata: {
          referredFarmId: farmId,
          amount: commission.amount.toNumber(),
          held: !approve,
        },
      });
      this.log.info('Referral commission accrued', {
        referrerFarmId: referral.referrerFarmId,
        referredFarmId: farmId,
        held: !approve,
      });
    } catch (err) {
      this.log.error('Referral commission accrual failed', err, {
        farmId,
        invoiceId,
      });
    }
  }

  /**
   * REF-05 — reverse an APPROVED/PAID commission when its triggering invoice
   * is refunded. Idempotent (a re-refund or replay is a no-op).
   */
  async clawback(invoiceId: string, actorUserId: string): Promise<void> {
    const commission = await this.prisma.referralCommission.findUnique({
      where: { idempotencyKey: invoiceId },
    });
    if (
      !commission ||
      commission.status === CommissionStatus.CLAWED_BACK ||
      commission.status === CommissionStatus.PENDING
    ) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.referralCommission.update({
        where: { id: commission.id },
        data: {
          status: CommissionStatus.CLAWED_BACK,
          clawedBackAt: new Date(),
        },
      });
      // Wallet can go negative — nets against future earnings, never an
      // out-of-pocket demand (REF-05).
      await this.creditWallet.debit(
        commission.referrerFarmId,
        commission.amount,
        { allowNegative: true, db: tx },
      );
    });

    await this.audit.record({
      actorUserId,
      action: AuditAction.REFERRAL_CLAWED_BACK,
      entityType: 'ReferralCommission',
      entityId: commission.id,
      farmId: commission.referrerFarmId,
      metadata: {
        invoiceId,
        amount: commission.amount.toNumber(),
      },
    });
  }

  async getReferralsForFarm(
    farmId: string,
    userId: string,
  ): Promise<ReferralSummary> {
    const code = await this.getOrCreateCode(farmId, userId);
    const [referrals, balance] = await Promise.all([
      this.prisma.referral.findMany({
        where: { referrerFarmId: farmId },
        orderBy: { boundAt: 'desc' },
      }),
      this.creditWallet.getBalance(farmId),
    ]);

    return {
      code: code.code,
      active: code.active,
      wallet_balance: balance.toNumber(),
      referred_farms: referrals.map((r) => ({
        farm_id: r.referredFarmId,
        status: r.status,
        flagged: r.flagged,
        bound_at: r.boundAt.toISOString(),
        qualified_at: r.qualifiedAt ? r.qualifiedAt.toISOString() : null,
      })),
    };
  }

  async getCommissionsForFarm(farmId: string) {
    const commissions = await this.prisma.referralCommission.findMany({
      where: { referrerFarmId: farmId },
      orderBy: { createdAt: 'desc' },
    });
    return commissions.map((c) => ({
      id: c.id,
      referred_farm_id: c.referredFarmId,
      reward_type: c.rewardType,
      amount: c.amount.toNumber(),
      status: c.status,
      created_at: c.createdAt.toISOString(),
      clawed_back_at: c.clawedBackAt ? c.clawedBackAt.toISOString() : null,
    }));
  }

  /**
   * Cross-tenant commission ledger for the platform-admin surface (RAKHAL-224,
   * behind `PlatformAdminGuard`). Read-only — the flagged-commission
   * approve/reject console is RAKHAL-231. Optional `status` filter surfaces the
   * `PENDING` (velocity-flagged) queue.
   */
  async listAllCommissions(status?: CommissionStatus) {
    const commissions = await this.prisma.referralCommission.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return commissions.map((c) => ({
      id: c.id,
      referrer_farm_id: c.referrerFarmId,
      referred_farm_id: c.referredFarmId,
      trigger_invoice_id: c.triggerInvoiceId,
      reward_type: c.rewardType,
      amount: c.amount.toNumber(),
      status: c.status,
      created_at: c.createdAt.toISOString(),
      clawed_back_at: c.clawedBackAt ? c.clawedBackAt.toISOString() : null,
    }));
  }

  private async farmOwnerId(farmId: string): Promise<string | null> {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: { ownerId: true },
    });
    return farm?.ownerId ?? null;
  }

  private async uniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = randomBytes(6).toString('hex').toUpperCase();
      const taken = await this.prisma.referralCode.findUnique({
        where: { code: candidate },
      });
      if (!taken) return candidate;
    }
    throw new ConflictException('Could not generate a unique referral code');
  }
}
