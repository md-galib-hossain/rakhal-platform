import { Controller, Get } from '@nestjs/common';
import { PlanCatalogueService } from '../../application/services/plan-catalogue.service';
import { ApiTags } from '@nestjs/swagger';

/**
 * Public subscription-plans catalogue (RAKHAL-217, PRD §31.1) — `customer-api`.
 * Resolves under the global prefix as `GET /api/v1/plans`.
 *
 * **Intentionally unguarded:** this is the pre-login pricing page, so no farm
 * guard chain and no `@RequireFeature`. It exposes no tenant data — only the
 * seeded plan/feature/limit catalogue.
 */
@ApiTags('Subscription')
@Controller('plans')
export class PlanController {
  constructor(private readonly planCatalogue: PlanCatalogueService) {}

  @Get()
  list() {
    return this.planCatalogue.listPlans();
  }
}
