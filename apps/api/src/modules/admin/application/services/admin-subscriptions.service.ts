import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FarmSubscription,
  Prisma,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { SubscriptionAccessService } from 'src/modules/subscription/application/services/subscription-access.service';
import { SubscriptionLifecycleService } from 'src/modules/subscription/application/services/subscription-lifecycle.service';
import {
  ActivateSubscriptionDto,
  CompSubscriptionDto,
  ExtendSubscriptionDto,
  SetPlanFeatureDto,
  SubscriptionActionDto,
  UpdatePlanDto,
} from '../../presentation/dto/admin-subscription.dto';
import { AdminAuditService } from './admin-audit.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const planSnapshot = (p: SubscriptionPlan) => ({
  description: p.description,
  monthlyPrice: p.monthlyPrice.toString(),
  yearlyPrice: p.yearlyPrice?.toString() ?? null,
  maxCattle: p.maxCattle,
  maxFarmMembers: p.maxFarmMembers,
});

/**
 * Commercial administration (Phase 6): the plan / feature matrix editor and manual subscription operations.
 * Every change needs a written reason, is audited with before/after, and busts the entitlement cache for the
 * affected farms so a change takes effect on the next request. Manual operations create **no invoice and no
 * payment** — they are support/commercial decisions, distinguishable in the audit trail.
 */
@Injectable()
export class AdminSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: SubscriptionLifecycleService,
    private readonly access: SubscriptionAccessService,
    private readonly audit: AdminAuditService,
  ) {}

  // ----------------------------------------------------------- plan matrix

  async matrix() {
    const [plans, features, latest] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({
        orderBy: [{ monthlyPrice: 'asc' }, { id: 'asc' }],
        include: {
          features: {
            select: { enabled: true, feature: { select: { key: true } } },
          },
        },
      }),
      this.prisma.feature.findMany({ orderBy: { key: 'asc' } }),
      // Farms per plan, each farm counted once by its latest subscription.
      this.prisma.$queryRaw<{ planId: string; n: bigint }[]>`
        SELECT "subscriptionPlanId" AS "planId", count(*) AS n
        FROM (
          SELECT DISTINCT ON ("farmId") "subscriptionPlanId"
          FROM "FarmSubscription"
          ORDER BY "farmId", "createdAt" DESC
        ) latest
        GROUP BY 1`,
    ]);
    const farmsByPlan = new Map(latest.map((r) => [r.planId, Number(r.n)]));
    return {
      features,
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        monthlyPrice: p.monthlyPrice.toNumber(),
        yearlyPrice: p.yearlyPrice?.toNumber() ?? null,
        maxCattle: p.maxCattle,
        maxFarmMembers: p.maxFarmMembers,
        farmCount: farmsByPlan.get(p.id) ?? 0,
        enabledFeatures: p.features
          .filter((f) => f.enabled)
          .map((f) => f.feature.key),
      })),
    };
  }

  async updatePlan(actorId: string, id: string, dto: UpdatePlanDto) {
    const before = await this.getPlan(id);
    const data: Prisma.SubscriptionPlanUpdateInput = {
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.monthlyPrice !== undefined
        ? { monthlyPrice: dto.monthlyPrice }
        : {}),
      ...(dto.yearlyPrice !== undefined
        ? { yearlyPrice: dto.yearlyPrice }
        : {}),
      ...(dto.maxCattle !== undefined ? { maxCattle: dto.maxCattle } : {}),
      ...(dto.maxFarmMembers !== undefined
        ? { maxFarmMembers: dto.maxFarmMembers }
        : {}),
    };
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nothing to change');
    }
    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data,
    });
    await this.invalidatePlanFarms(id);
    await this.audit.record({
      adminId: actorId,
      action: 'PLAN_UPDATED',
      entityType: 'SubscriptionPlan',
      entityId: id,
      before: planSnapshot(before),
      after: planSnapshot(plan),
      metadata: { reason: dto.reason, plan: plan.name },
    });
    return plan;
  }

  async setPlanFeature(
    actorId: string,
    planId: string,
    featureKey: string,
    dto: SetPlanFeatureDto,
  ) {
    const plan = await this.getPlan(planId);
    const feature = await this.prisma.feature.findUnique({
      where: { key: featureKey },
    });
    if (!feature) throw new NotFoundException('Feature not found');

    const existing = await this.prisma.subscriptionFeature.findUnique({
      where: {
        subscriptionPlanId_featureId: {
          subscriptionPlanId: planId,
          featureId: feature.id,
        },
      },
    });
    const wasEnabled = existing?.enabled ?? false;
    await this.prisma.subscriptionFeature.upsert({
      where: {
        subscriptionPlanId_featureId: {
          subscriptionPlanId: planId,
          featureId: feature.id,
        },
      },
      create: {
        subscriptionPlanId: planId,
        featureId: feature.id,
        enabled: dto.enabled,
      },
      update: { enabled: dto.enabled },
    });
    await this.invalidatePlanFarms(planId);
    await this.audit.record({
      adminId: actorId,
      action: 'PLAN_FEATURE_SET',
      entityType: 'SubscriptionPlan',
      entityId: planId,
      before: { feature: featureKey, enabled: wasEnabled },
      after: { feature: featureKey, enabled: dto.enabled },
      metadata: { reason: dto.reason, plan: plan.name },
    });
    return {
      planId,
      feature: featureKey,
      enabled: dto.enabled,
      changed: wasEnabled !== dto.enabled,
    };
  }

  // -------------------------------------------------- manual subscriptions

  async activate(
    actorId: string,
    farmId: string,
    dto: ActivateSubscriptionDto,
  ) {
    const farm = await this.farm(farmId, dto);
    const plan = await this.getPlan(dto.planId);
    const before = await this.latest(farmId);
    const sub = await this.lifecycle.activate(farmId, plan.id, dto.period);
    await this.record(
      actorId,
      'SUBSCRIPTION_ACTIVATED',
      farm,
      before,
      sub,
      plan.name,
      dto.reason,
      {
        period: dto.period,
      },
    );
    return this.view(sub, plan.name);
  }

  async comp(actorId: string, farmId: string, dto: CompSubscriptionDto) {
    const farm = await this.farm(farmId, dto);
    const plan = await this.getPlan(dto.planId);
    const before = await this.latest(farmId);
    const now = new Date();
    const sub = await this.prisma.farmSubscription.create({
      data: {
        farmId,
        subscriptionPlanId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        startsAt: now,
        expiresAt: new Date(now.getTime() + dto.days * DAY_MS),
      },
    });
    await this.access.invalidateFarm(farmId);
    await this.record(
      actorId,
      'SUBSCRIPTION_COMPED',
      farm,
      before,
      sub,
      plan.name,
      dto.reason,
      {
        days: dto.days,
      },
    );
    return this.view(sub, plan.name);
  }

  async extend(actorId: string, farmId: string, dto: ExtendSubscriptionDto) {
    const farm = await this.farm(farmId, dto);
    const current = await this.latest(farmId);
    if (!current)
      throw new ConflictException('This farm has no subscription to extend');
    if (current.status === SubscriptionStatus.CANCELLED) {
      throw new ConflictException(
        'A cancelled subscription cannot be extended; activate a plan instead',
      );
    }
    const now = Date.now();
    const from = Math.max(now, current.expiresAt?.getTime() ?? now);
    const revive =
      current.status === SubscriptionStatus.EXPIRED ||
      current.status === SubscriptionStatus.PAST_DUE;
    const sub = await this.prisma.farmSubscription.update({
      where: { id: current.id },
      data: {
        expiresAt: new Date(from + dto.days * DAY_MS),
        ...(revive ? { status: SubscriptionStatus.ACTIVE } : {}),
      },
    });
    await this.access.invalidateFarm(farmId);
    const plan = await this.getPlan(sub.subscriptionPlanId);
    await this.record(
      actorId,
      'SUBSCRIPTION_EXTENDED',
      farm,
      current,
      sub,
      plan.name,
      dto.reason,
      {
        days: dto.days,
      },
    );
    return this.view(sub, plan.name);
  }

  async cancel(actorId: string, farmId: string, dto: SubscriptionActionDto) {
    const farm = await this.farm(farmId, dto);
    const current = await this.latest(farmId);
    if (!current)
      throw new ConflictException('This farm has no subscription to cancel');
    if (current.status === SubscriptionStatus.CANCELLED) {
      return this.view(
        current,
        (await this.getPlan(current.subscriptionPlanId)).name,
        false,
      );
    }
    const sub = await this.prisma.farmSubscription.update({
      where: { id: current.id },
      data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
    });
    await this.access.invalidateFarm(farmId);
    const plan = await this.getPlan(sub.subscriptionPlanId);
    await this.record(
      actorId,
      'SUBSCRIPTION_CANCELLED',
      farm,
      current,
      sub,
      plan.name,
      dto.reason,
      {},
    );
    return this.view(sub, plan.name);
  }

  // -------------------------------------------------------------- helpers

  private async farm(id: string, dto: SubscriptionActionDto) {
    const farm = await this.prisma.farm.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!farm) throw new NotFoundException('Farm not found');
    if (dto.confirm.trim() !== farm.name) {
      throw new BadRequestException(
        'Confirmation does not match the farm name',
      );
    }
    return farm;
  }

  private latest(farmId: string) {
    return this.prisma.farmSubscription.findFirst({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getPlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  private async invalidatePlanFarms(planId: string) {
    const rows = await this.prisma.farmSubscription.findMany({
      where: { subscriptionPlanId: planId },
      distinct: ['farmId'],
      select: { farmId: true },
    });
    await Promise.all(rows.map((r) => this.access.invalidateFarm(r.farmId)));
  }

  private async record(
    actorId: string,
    action:
      | 'SUBSCRIPTION_ACTIVATED'
      | 'SUBSCRIPTION_COMPED'
      | 'SUBSCRIPTION_EXTENDED'
      | 'SUBSCRIPTION_CANCELLED',
    farm: { id: string; name: string },
    before: FarmSubscription | null,
    after: FarmSubscription,
    planName: string,
    reason: string,
    extra: Record<string, unknown>,
  ) {
    const beforePlan = before
      ? (await this.getPlan(before.subscriptionPlanId)).name
      : null;
    await this.audit.record({
      adminId: actorId,
      action,
      entityType: 'Farm',
      entityId: farm.id,
      before: before
        ? {
            plan: beforePlan,
            status: before.status,
            expiresAt: before.expiresAt,
          }
        : null,
      after: {
        plan: planName,
        status: after.status,
        expiresAt: after.expiresAt,
      },
      metadata: { reason, farmName: farm.name, manual: true, ...extra },
    });
  }

  private view(sub: FarmSubscription, plan: string, changed = true) {
    return {
      farmId: sub.farmId,
      plan,
      status: sub.status,
      startsAt: sub.startsAt,
      expiresAt: sub.expiresAt,
      cancelledAt: sub.cancelledAt,
      changed,
    };
  }
}
