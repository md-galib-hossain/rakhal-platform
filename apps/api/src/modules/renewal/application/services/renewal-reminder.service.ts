import { Injectable } from '@nestjs/common';
import { RenewalStage, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import { TransactionalEmailService } from 'src/modules/email/application/services/transactional-email.service';
import { EmailTemplate } from 'src/modules/email/domain/enums/email-template.enum';
import {
  calendarDaysBetween,
  preExpiryStageFor,
  winbackStageFor,
} from '../../domain/renewal-cadence';

interface Candidate {
  id: string;
  farmId: string;
  status: SubscriptionStatus;
  expiresAt: Date | null;
}

interface StageCopy {
  title: string;
  message: string;
  subject: string;
  headline: string;
  body: string;
}

const RENEW_LINK = '/subscription';

/**
 * Renewal reminders + win-back (RAKHAL-240, PRD §36.5). Driven by the daily
 * scheduler (RAKHAL-095). **Reminds, never charges** (ADR-014/SUB-02a). Reads the
 * farm's *current* subscription (latest row, mirroring `resolveEntitlement`) so a
 * **manual renewal instantly clears the campaign** (RNW-02 — the latest row is
 * then ACTIVE, so win-back stops). Each (subscription, stage) fires once — the
 * `RenewalReminder` unique index is the idempotency + tracking anchor (RNW-04).
 * In-app via the notification engine (opt-out respected there); email via the
 * idempotent transactional pipeline (pre-expiry = billing-transactional, always
 * sent; win-back = marketing, honours opt-out).
 */
@Injectable()
export class RenewalReminderService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly txEmail: TransactionalEmailService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(RenewalReminderService.name);
  }

  async runRenewalSweep(
    now: Date = new Date(),
  ): Promise<{ preExpiry: number; winback: number }> {
    const subs = await this.prisma.farmSubscription.findMany({
      where: {
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIALING,
            SubscriptionStatus.EXPIRED,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, farmId: true, status: true, expiresAt: true },
    });

    // The current subscription per farm — a renewed farm presents as ACTIVE, so
    // its old EXPIRED row is never win-back'd (RNW-02).
    const latest = new Map<string, Candidate>();
    for (const s of subs) if (!latest.has(s.farmId)) latest.set(s.farmId, s);

    let preExpiry = 0;
    let winback = 0;
    for (const sub of latest.values()) {
      if (!sub.expiresAt) continue;
      if (
        sub.status === SubscriptionStatus.ACTIVE ||
        sub.status === SubscriptionStatus.TRIALING
      ) {
        const daysUntil = calendarDaysBetween(now, sub.expiresAt);
        if (daysUntil < 0) continue;
        const stage = preExpiryStageFor(daysUntil);
        if (stage && (await this.fire(sub, stage, false))) preExpiry += 1;
      } else if (sub.status === SubscriptionStatus.EXPIRED) {
        const daysSince = calendarDaysBetween(sub.expiresAt, now);
        const stage = winbackStageFor(daysSince);
        if (stage && (await this.fire(sub, stage, true))) winback += 1;
      }
    }

    this.log.info('Renewal sweep complete', { preExpiry, winback });
    return { preExpiry, winback };
  }

  private async fire(
    sub: Candidate,
    stage: RenewalStage,
    isWinback: boolean,
  ): Promise<boolean> {
    // Idempotent per (subscription, stage) — a re-run / restart skips (RNW-04).
    const already = await this.prisma.renewalReminder.findUnique({
      where: { subscriptionId_stage: { subscriptionId: sub.id, stage } },
      select: { id: true },
    });
    if (already) return false;

    const farm = await this.prisma.farm.findUnique({
      where: { id: sub.farmId },
      select: {
        name: true,
        owner: { select: { id: true, email: true, name: true } },
      },
    });
    if (!farm?.owner?.email) return false;

    const eventKey = isWinback
      ? 'subscription_winback'
      : 'subscription_renewal_reminder';

    // Opt-out only gates the marketing win-back; pre-expiry billing reminders
    // always send (mandatory-billing bypasses marketing opt-out, COM-01).
    let optedOut = false;
    if (isWinback) {
      const pref = await this.prisma.notificationPreference.findFirst({
        where: { userId: farm.owner.id, eventKey },
        select: { enabled: true },
      });
      optedOut = pref ? !pref.enabled : false;
    }

    const channels: string[] = [];
    if (!optedOut) {
      const copy = this.copyFor(stage, isWinback);
      const created = await this.notifications.notifyFarmRoles({
        farmId: sub.farmId,
        roleNames: ['Owner'],
        eventKey,
        title: copy.title,
        message: copy.message,
        link: RENEW_LINK,
        dedupeKey: `${eventKey}:${sub.id}:${stage}`,
      });
      if (created.length > 0) channels.push('in_app');

      const res = await this.txEmail.sendOnce({
        idempotencyKey: `${eventKey}:${sub.id}:${stage}`,
        to: farm.owner.email,
        subject: copy.subject,
        template: EmailTemplate.SUBSCRIPTION_RENEWAL,
        templateData: {
          name: farm.owner.name ?? farm.name,
          headline: copy.headline,
          body: copy.body,
          ctaLink: RENEW_LINK,
        },
        tenantId: sub.farmId,
        farmId: sub.farmId,
        userId: farm.owner.id,
      });
      if (res.sent) channels.push('email');
    }

    // Ledger row = dedup anchor + conversion tracking (feeds RAKHAL-226).
    try {
      await this.prisma.renewalReminder.create({
        data: {
          farmId: sub.farmId,
          subscriptionId: sub.id,
          stage,
          channels,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') return false;
      throw err;
    }
    return true;
  }

  private copyFor(stage: RenewalStage, isWinback: boolean): StageCopy {
    if (isWinback) {
      const last = stage === RenewalStage.WINBACK_30;
      return {
        title: last
          ? 'Last chance to restore your Rakhal farm'
          : 'Your Rakhal subscription has expired',
        message: last
          ? 'Renew now to keep your herd records and reports.'
          : 'Come back — renew to restore full access to your farm.',
        subject: last
          ? 'Last chance — restore your Rakhal subscription'
          : 'We miss you at Rakhal — renew to restore access',
        headline: last
          ? 'Last chance to come back'
          : 'Your subscription has expired',
        body: 'Renew any time to restore full access to your dairy-farm operations — no data is lost while you are away.',
      };
    }

    const when =
      stage === RenewalStage.EXPIRY_DAY
        ? 'today'
        : stage === RenewalStage.T_MINUS_1
          ? 'tomorrow'
          : stage === RenewalStage.T_MINUS_3
            ? 'in 3 days'
            : 'in 7 days';
    return {
      title: `Your Rakhal subscription renews ${when}`,
      message: `Renew now to avoid any interruption to your farm access (${when}).`,
      subject: `Your Rakhal subscription expires ${when}`,
      headline: `Your subscription expires ${when}`,
      body: `To keep uninterrupted access to your dairy-farm operations, renew your subscription ${when}. It only takes a moment.`,
    };
  }
}
