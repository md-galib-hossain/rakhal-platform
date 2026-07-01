import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';

/** Public shape of a plan for the pricing page (snake_case per API convention). */
export interface PublicPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number | null;
  limits: {
    max_cattle: number | null;
    max_farm_members: number | null;
  };
  features: string[];
}

/**
 * Read-only plan catalogue for the public pricing endpoint (RAKHAL-217, PRD §31.1).
 * Serves the `customer-api` surface; **no farm scoping / no auth** — it's the
 * pre-login pricing list. Plans/features are seeded from `subscription-features.ts`.
 */
@Injectable()
export class PlanCatalogueService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(PlanCatalogueService.name);
  }

  async listPlans(): Promise<PublicPlan[]> {
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: [{ monthlyPrice: 'asc' }, { id: 'asc' }],
      include: {
        features: {
          where: { enabled: true },
          include: { feature: { select: { key: true } } },
        },
      },
    });

    this.log.debug('Listed subscription plans', { count: plans.length });

    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      monthly_price: plan.monthlyPrice.toNumber(),
      yearly_price:
        plan.yearlyPrice === null ? null : plan.yearlyPrice.toNumber(),
      limits: {
        max_cattle: plan.maxCattle,
        max_farm_members: plan.maxFarmMembers,
      },
      features: plan.features.map((planFeature) => planFeature.feature.key),
    }));
  }
}
