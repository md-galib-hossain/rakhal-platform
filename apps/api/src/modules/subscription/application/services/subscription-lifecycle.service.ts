import { Injectable } from '@nestjs/common';
import { FarmSubscription, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import {
  GRACE_PERIOD_DAYS,
  TRIAL_DURATION_DAYS,
  TRIAL_PLAN_NAME,
} from '../../domain/subscription-features';
import { SubscriptionAccessService } from './subscription-access.service';

const DAY_MS = 24 * 60 * 60 * 1000;

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
  ): Promise<{ pastDue: number; expired: number }> {
    const toPastDue = await this.prisma.farmSubscription.findMany({
      where: {
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
        expiresAt: { lt: now },
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
    }

    const affected = new Set([...toPastDue, ...toExpired].map((s) => s.farmId));
    for (const farmId of affected) {
      await this.access.invalidateFarm(farmId);
    }

    const result = { pastDue: toPastDue.length, expired: toExpired.length };
    this.log.info('Subscription expiry sweep complete', result);
    return result;
  }
}
