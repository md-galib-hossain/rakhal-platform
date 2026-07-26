import { Injectable } from '@nestjs/common';
import {
  BillingPeriod,
  FarmSubscription,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { TransactionalEmailService } from 'src/modules/email/application/services/transactional-email.service';
import { EmailTemplate } from 'src/modules/email/domain/enums/email-template.enum';
import {
  GRACE_PERIOD_DAYS,
  PLAN_NAMES,
  TRIAL_DURATION_DAYS,
  TRIAL_PLAN_NAME,
} from '../../domain/subscription-features';
import { SubscriptionAccessService } from './subscription-access.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Advance a date by one billing period (calendar month/year). */
function addBillingPeriod(from: Date, period: BillingPeriod): Date {
  const d = new Date(from);
  if (period === BillingPeriod.YEARLY) {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

interface ProvisionOptions {
  planName: string;
  status: SubscriptionStatus;
  /** Days until expiry, or null for open-ended. */
  durationDays: number | null;
}

/**
 * Subscription lifecycle (RAKHAL-218, PRD §31.2): trial provisioning on farm
 * bootstrap + the daily expiry sweep. Every state change busts the entitlement
 * cache (SUB-06). **No auto-renewal** (ADR-014) — this never charges; renewal
 * reminders + win-back are RAKHAL-240.
 */
@Injectable()
export class SubscriptionLifecycleService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SubscriptionAccessService,
    private readonly txEmail: TransactionalEmailService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(SubscriptionLifecycleService.name);
  }

  /**
   * Give a farm a subscription if it has none. Idempotent + **best-effort**: if
   * the target plan isn't seeded, logs and returns null rather than blocking
   * farm bootstrap.
   */
  async provision(
    farmId: string,
    opts: ProvisionOptions,
  ): Promise<FarmSubscription | null> {
    const existing = await this.prisma.farmSubscription.findFirst({
      where: { farmId },
    });
    if (existing) {
      return existing;
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { name: opts.planName },
      select: { id: true },
    });
    if (!plan) {
      this.log.warn('Plan not found — skipping subscription provisioning', {
        farmId,
        planName: opts.planName,
      });
      return null;
    }

    const now = new Date();
    const expiresAt =
      opts.durationDays === null
        ? null
        : new Date(now.getTime() + opts.durationDays * DAY_MS);

    const sub = await this.prisma.farmSubscription.create({
      data: {
        farmId,
        subscriptionPlanId: plan.id,
        status: opts.status,
        startsAt: now,
        expiresAt,
      },
    });
    await this.access.invalidateFarm(farmId);
    this.log.info('Subscription provisioned', {
      farmId,
      plan: opts.planName,
      status: opts.status,
    });
    return sub;
  }

  /** New-farm trial: Starter, TRIALING, 14 days (SUB-01). */
  async provisionTrial(farmId: string): Promise<FarmSubscription | null> {
    return this.provision(farmId, {
      planName: TRIAL_PLAN_NAME,
      status: SubscriptionStatus.TRIALING,
      durationDays: TRIAL_DURATION_DAYS,
    });
  }

  /**
   * Free-plan safety net (PRD §31.1: "then auto-downgrade to Free" — the Free
   * tier is the floor every farm should land on, never `NONE`). Idempotent via
   * `provision`'s existing-row check, so it's safe to call unconditionally
   * after a trial attempt that was skipped (repeat-owner) or failed (missing
   * plan seed, transient error) — a farm is never left with no subscription
   * at all just because it didn't qualify for a trial.
   */
  async ensureUsableSubscription(
    farmId: string,
  ): Promise<FarmSubscription | null> {
    return this.provision(farmId, {
      planName: PLAN_NAMES.FREE,
      status: SubscriptionStatus.ACTIVE,
      durationDays: null,
    });
  }

  /**
   * Downgrade an EXPIRED farm onto Free (PRD §31.1's auto-downgrade promise —
   * distinct from the `PAST_DUE` grace, which is for a paid plan that lapsed
   * mid-cycle). Unlike `ensureUsableSubscription`, this always creates a fresh
   * `ACTIVE` row even though one already exists (same "new row per state
   * change" pattern as `activate()`), since the farm's *current* row is the
   * just-expired one this replaces going forward.
   */
  private async downgradeToFree(farmId: string): Promise<void> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { name: PLAN_NAMES.FREE },
      select: { id: true },
    });
    if (!plan) {
      this.log.warn('Free plan not seeded — cannot auto-downgrade', {
        farmId,
      });
      return;
    }

    await this.prisma.farmSubscription.create({
      data: {
        farmId,
        subscriptionPlanId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        startsAt: new Date(),
        expiresAt: null,
      },
    });
    this.log.info('Farm auto-downgraded to Free after expiry', { farmId });
  }

  /**
   * Daily expiry transitions (SUB-03). Idempotent + re-run-safe (only rows
   * matching the time condition move; a re-run finds none). Self-correcting: a
   * subscription that expired while the sweep was down can advance
   * ACTIVE→PAST_DUE→EXPIRED in one run.
   *
   *  - `ACTIVE`/`TRIALING` past `expiresAt`            → `PAST_DUE` (grace starts)
   *  - `PAST_DUE` past `expiresAt + GRACE_PERIOD_DAYS` → `EXPIRED`
   */
  async runExpirySweep(
    now: Date = new Date(),
  ): Promise<{ pastDue: number; expired: number; downgraded: number }> {
    // A scheduled downgrade/lateral switch (RFE-036 follow-up, PAY-08) applies here — BEFORE the
    // PAST_DUE transition below — so a farm that arranged a switch never sees a lapse: the new plan
    // activates seamlessly the moment the old one would have expired. Selected first so the same rows
    // are excluded from `toPastDue` (a farm subscription only ever holds one currently-relevant path).
    const toDowngrade = await this.prisma.farmSubscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { lte: now },
        pendingPlanId: { not: null },
      },
      select: {
        id: true,
        farmId: true,
        pendingPlanId: true,
        pendingBillingPeriod: true,
      },
    });
    for (const row of toDowngrade) {
      if (!row.pendingPlanId || !row.pendingBillingPeriod) continue;
      await this.activate(
        row.farmId,
        row.pendingPlanId,
        row.pendingBillingPeriod,
      );
      this.log.info('Scheduled downgrade applied', {
        farmId: row.farmId,
        planId: row.pendingPlanId,
      });
    }

    const toPastDue = await this.prisma.farmSubscription.findMany({
      where: {
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
        expiresAt: { lt: now },
        id: { notIn: toDowngrade.map((r) => r.id) },
      },
      select: { id: true, farmId: true },
    });
    if (toPastDue.length > 0) {
      await this.prisma.farmSubscription.updateMany({
        where: { id: { in: toPastDue.map((s) => s.id) } },
        data: { status: SubscriptionStatus.PAST_DUE },
      });
    }

    const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_DAYS * DAY_MS);
    const toExpired = await this.prisma.farmSubscription.findMany({
      where: {
        status: SubscriptionStatus.PAST_DUE,
        expiresAt: { lt: graceCutoff },
      },
      select: { id: true, farmId: true },
    });
    if (toExpired.length > 0) {
      await this.prisma.farmSubscription.updateMany({
        where: { id: { in: toExpired.map((s) => s.id) } },
        data: { status: SubscriptionStatus.EXPIRED },
      });
      // Auto-downgrade to Free (PRD §31.1) rather than leaving the farm on a
      // dead `EXPIRED` row forever — this is the floor, not a dead end.
      for (const row of toExpired) {
        await this.downgradeToFree(row.farmId);
      }
    }

    const affected = new Set([...toPastDue, ...toExpired].map((s) => s.farmId));
    for (const farmId of affected) {
      await this.access.invalidateFarm(farmId);
    }

    // Transactional expiry emails (RAKHAL-238, COM-01) — idempotent per
    // subscription+status so a re-run / self-correcting sweep never double-mails.
    await this.sendExpiryEmails(toPastDue, SubscriptionStatus.PAST_DUE);
    await this.sendExpiryEmails(toExpired, SubscriptionStatus.EXPIRED);

    const result = {
      pastDue: toPastDue.length,
      expired: toExpired.length,
      downgraded: toDowngrade.length,
    };
    this.log.info('Subscription expiry sweep complete', result);
    return result;
  }

  /** Email each transitioned farm's owner (best-effort, idempotent). */
  private async sendExpiryEmails(
    transitions: { id: string; farmId: string }[],
    status: SubscriptionStatus,
  ): Promise<void> {
    for (const t of transitions) {
      try {
        const farm = await this.prisma.farm.findUnique({
          where: { id: t.farmId },
          select: {
            name: true,
            owner: { select: { email: true, name: true } },
          },
        });
        if (!farm?.owner?.email) continue;
        const sub = await this.prisma.farmSubscription.findUnique({
          where: { id: t.id },
          select: { expiresAt: true },
        });
        await this.txEmail.sendOnce({
          idempotencyKey: `subscription_expiry:${t.id}:${status}`,
          to: farm.owner.email,
          subject:
            status === SubscriptionStatus.EXPIRED
              ? 'Your Rakhal subscription has expired'
              : 'Your Rakhal subscription needs attention',
          template: EmailTemplate.SUBSCRIPTION_EXPIRY,
          templateData: {
            name: farm.owner.name ?? farm.name,
            expiryDate: sub?.expiresAt
              ? sub.expiresAt.toISOString().slice(0, 10)
              : '',
          },
          tenantId: t.farmId,
          farmId: t.farmId,
          userId: null,
        });
      } catch {
        // best-effort — an email hiccup never affects the sweep
      }
    }
  }

  /**
   * Activate/extend a farm's subscription after a PAID invoice (RAKHAL-220).
   * Creates a fresh `ACTIVE` row (history preserved; `resolveEntitlement` reads
   * the latest). Renewing the *same* plan while still active extends from the
   * current expiry; otherwise it starts now. Busts the entitlement cache.
   */
  async activate(
    farmId: string,
    planId: string,
    period: BillingPeriod,
  ): Promise<FarmSubscription> {
    const now = new Date();
    const current = await this.prisma.farmSubscription.findFirst({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
    });
    const extendFrom =
      current &&
      current.subscriptionPlanId === planId &&
      current.status === SubscriptionStatus.ACTIVE &&
      current.expiresAt &&
      current.expiresAt > now
        ? current.expiresAt
        : now;

    const sub = await this.prisma.farmSubscription.create({
      data: {
        farmId,
        subscriptionPlanId: planId,
        status: SubscriptionStatus.ACTIVE,
        startsAt: now,
        expiresAt: addBillingPeriod(extendFrom, period),
      },
    });
    await this.access.invalidateFarm(farmId);
    this.log.info('Subscription activated from paid invoice', {
      farmId,
      planId,
      period,
    });
    return sub;
  }
}
