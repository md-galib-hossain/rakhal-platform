import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentFarmId } from 'src/common/decorators';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { SubscriptionAccessService } from '../../application/services/subscription-access.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Self-serve subscription status (RAKHAL-218/219 / SUB-07, `customer-api`) →
 * `GET /api/v1/subscription`. Any farm member may read their own farm's
 * entitlement — status, plan, expiry, resolved features, limits, and **usage vs
 * limits** — so the client can grey-out gated UI + show "X / Y cattle used".
 * No `@RequireFeature` / no baseline `SubscriptionGuard`: an expired farm must
 * still see its status to know it needs to renew.
 */
@ApiTags('Subscription')
@ApiBearerAuth()
@Controller('subscription')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard)
export class SubscriptionController {
  constructor(
    private readonly access: SubscriptionAccessService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async get(@CurrentFarmId() farmId: string) {
    const [e, cattle, members, current] = await Promise.all([
      this.access.resolveEntitlement(farmId),
      this.prisma.cattle.count({ where: { farmId, isActive: true } }),
      this.prisma.farmMember.count({ where: { farmId } }),
      // Display-only — a scheduled downgrade (RFE-036 follow-up) doesn't affect the cached
      // entitlement above, so it's read directly off the latest row rather than threaded through
      // `resolveEntitlement`.
      this.prisma.farmSubscription.findFirst({
        where: { farmId },
        orderBy: { createdAt: 'desc' },
        include: { pendingPlan: { select: { id: true, name: true } } },
      }),
    ]);
    return {
      status: e.status,
      plan_id: e.planId,
      plan_name: e.planName,
      expires_at: e.expiresAt,
      features: e.features,
      limits: {
        max_cattle: e.limits.maxCattle,
        max_farm_members: e.limits.maxFarmMembers,
      },
      usage: { cattle, farm_members: members },
      pending_plan_id: current?.pendingPlan?.id ?? null,
      pending_plan_name: current?.pendingPlan?.name ?? null,
      pending_effective_at: current?.pendingPlan
        ? (current.expiresAt?.toISOString() ?? null)
        : null,
    };
  }
}
