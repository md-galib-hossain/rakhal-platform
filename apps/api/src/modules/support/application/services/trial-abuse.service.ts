import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AuditService } from 'src/modules/audit/application/services/audit.service';
import { SubscriptionLifecycleService } from 'src/modules/subscription/application/services/subscription-lifecycle.service';

/**
 * Trial-abuse guard (RAKHAL-242, SUP-02). Enforces **one free trial per owner
 * identity**: the first farm an owner bootstraps records a `TrialGrant` (unique
 * on `userId`) and gets the 14-day trial; a second farm by the same owner hits
 * the unique constraint → no trial + a flagged/audited event. The unique index
 * is the real guard (race-safe). Phone-identity matching is deferred (no phone-
 * number field exists yet — mirrors the referral fraud-matching gap, RD-026).
 */
@Injectable()
export class TrialAbuseService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: SubscriptionLifecycleService,
    private readonly audit: AuditService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(TrialAbuseService.name);
  }

  async grantTrialIfEligible(
    farmId: string,
    ownerUserId: string,
  ): Promise<{ granted: boolean }> {
    try {
      await this.prisma.trialGrant.create({
        data: { userId: ownerUserId, farmId },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        this.log.warn(
          'Duplicate trial blocked (owner already used their trial)',
          {
            ownerUserId,
            farmId,
          },
        );
        await this.audit
          .record({
            actorUserId: ownerUserId,
            action: AuditAction.SUSPICIOUS_ACTIVITY,
            entityType: 'Farm',
            entityId: farmId,
            farmId,
            metadata: { reason: 'DUPLICATE_TRIAL_BLOCKED' },
          })
          .catch(() => undefined);
        return { granted: false };
      }
      throw err;
    }

    await this.lifecycle.provisionTrial(farmId);
    return { granted: true };
  }
}
