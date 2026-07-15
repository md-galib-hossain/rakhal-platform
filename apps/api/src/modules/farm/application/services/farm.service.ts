import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Farm, FarmStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { SYSTEM_ROLES } from 'src/modules/permission/domain/permission-catalogue';
import { TrialAbuseService } from 'src/modules/support/application/services/trial-abuse.service';
import { ReferralService } from 'src/modules/billing/application/services/referral.service';
import { LegalConsentService } from 'src/modules/compliance/application/services/legal-consent.service';
import { TransactionalEmailService } from 'src/modules/email/application/services/transactional-email.service';
import { EmailTemplate } from 'src/modules/email/domain/enums/email-template.enum';
import { AppLanguage } from 'src/common/i18n/language';
import { CreateFarmDto } from '../../presentation/dto/create-farm.dto';

/**
 * Farm bootstrap (RAKHAL-021, partial). Creating a farm makes the caller its
 * Owner: it creates the Farm, then a FarmMember linking the user to the global
 * Owner system role — which is what lets `FarmContextGuard` + `PermissionGuard`
 * resolve the owner's permissions on subsequent requests.
 *
 * Requires the RBAC seed (`prisma/seed.ts`) to have created the Owner role.
 */
@Injectable()
export class FarmService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly trialAbuse: TrialAbuseService,
    private readonly referrals: ReferralService,
    private readonly legal: LegalConsentService,
    private readonly txEmail: TransactionalEmailService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(FarmService.name);
  }

  async create(userId: string, dto: CreateFarmDto): Promise<Farm> {
    // LGL-02: the current Terms + Privacy must be accepted before a farm exists.
    await this.legal.assertConsent(userId);

    const ownerRole = await this.prisma.role.findFirst({
      where: { name: SYSTEM_ROLES.OWNER, farmId: null, isSystemRole: true },
      select: { id: true },
    });
    if (!ownerRole) {
      this.log.error(
        'Owner system role missing — run the RBAC seed',
        undefined,
      );
      throw new InternalServerErrorException('System roles are not configured');
    }

    const slug = await this.uniqueSlug(dto.name);

    const farm = await this.prisma.farm.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        ownerId: userId,
        members: {
          create: { userId, roleId: ownerRole.id },
        },
      },
    });

    this.log.info('Farm created', { farmId: farm.id, ownerId: userId });

    // Welcome email (RAKHAL-238, COM-01) — once per owner (idempotency key on
    // the user, not the farm, so a 2nd farm doesn't re-welcome). Best-effort.
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, preferredLanguage: true },
      });
      if (user) {
        await this.txEmail.sendOnce({
          idempotencyKey: `welcome:${userId}`,
          to: user.email,
          subject: 'Welcome to Rakhal',
          template: EmailTemplate.WELCOME_EMAIL,
          templateData: { name: user.name },
          tenantId: userId,
          farmId: farm.id,
          userId,
          locale: user.preferredLanguage.toLowerCase() as AppLanguage,
        });
      }
    } catch (err) {
      this.log.error('Welcome email failed (farm still created)', err);
    }

    // Auto-provision the 14-day Starter trial (SUB-01) — but only if this owner
    // is eligible (one free trial per owner identity, SUP-02/RAKHAL-242). A
    // repeat owner gets the farm with no trial + a flagged/audited event.
    // Best-effort — never block farm bootstrap on a provisioning hiccup.
    try {
      await this.trialAbuse.grantTrialIfEligible(farm.id, userId);
    } catch (err) {
      this.log.error('Trial provisioning failed (farm still created)', err);
    }

    // REF-01: bind the referral captured at signup, once, permanently.
    // Best-effort — an unknown code or any error must never block bootstrap.
    if (dto.referralCode) {
      try {
        await this.referrals.bindReferral(farm.id, userId, dto.referralCode);
      } catch (err) {
        this.log.error('Referral attribution failed (farm still created)', err);
      }
    }

    return farm;
  }

  /** Farms the user is a member of (for the org switcher / login farm selection). */
  async listMine(userId: string) {
    const memberships = await this.prisma.farmMember.findMany({
      where: { userId, farm: { deletedAt: null } },
      select: {
        role: { select: { name: true } },
        farm: {
          select: { id: true, name: true, slug: true, status: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({ ...m.farm, role: m.role.name }));
  }

  /**
   * Soft-delete: flips `status` to ARCHIVED and stamps `deletedAt`, nothing else. Related
   * data (cattle, finance, milk logs, etc.) is left untouched by design — a hard purge is a
   * separate, deliberately deferred admin-side operation (see docs/TECH_DEBT.md). Only the
   * farm's actual `ownerId` may delete it (not just any Owner-role member, in case that role
   * is ever granted to more than one person) — `TenantAccessService.resolveFarmContext` already
   * rejects `deletedAt`/non-ACTIVE farms on every subsequent request, so this takes effect
   * immediately for every session scoped to this farm.
   */
  async softDelete(farmId: string, userId: string): Promise<{ success: true }> {
    const farm = await this.prisma.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true, ownerId: true },
    });
    if (!farm) {
      throw new NotFoundException('Farm not found');
    }
    if (farm.ownerId !== userId) {
      throw new ForbiddenException('Only the farm owner can delete this farm');
    }

    await this.prisma.farm.update({
      where: { id: farmId },
      data: { deletedAt: new Date(), status: FarmStatus.ARCHIVED },
    });

    this.log.info('Farm soft-deleted', { farmId, ownerId: userId });

    return { success: true };
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 40) || 'farm';

    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const taken = await this.prisma.farm.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    throw new ConflictException('Could not generate a unique farm slug');
  }
}
