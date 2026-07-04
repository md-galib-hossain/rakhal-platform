import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Farm } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { SYSTEM_ROLES } from 'src/modules/permission/domain/permission-catalogue';
import { SubscriptionLifecycleService } from 'src/modules/subscription/application/services/subscription-lifecycle.service';
import { ReferralService } from 'src/modules/billing/application/services/referral.service';
import { LegalConsentService } from 'src/modules/compliance/application/services/legal-consent.service';
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
    private readonly subscriptionLifecycle: SubscriptionLifecycleService,
    private readonly referrals: ReferralService,
    private readonly legal: LegalConsentService,
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

    // Auto-provision the 14-day Starter trial (SUB-01). Best-effort — never
    // block farm bootstrap if plans aren't seeded / provisioning hiccups.
    try {
      await this.subscriptionLifecycle.provisionTrial(farm.id);
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
