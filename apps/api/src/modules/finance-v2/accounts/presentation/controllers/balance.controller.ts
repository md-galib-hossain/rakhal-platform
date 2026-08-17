import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { BalanceService } from '../../application/balance.service';

/**
 * Finance V2 → Balance projection (RAKHAL-336, `FINANCE_V2_DESIGN.md` §3).
 * Resolves under the global prefix as `GET /api/v1/finance/balance`.
 *
 * Same guard chain + permission as the sibling `FinancialAccountController`
 * (RAKHAL-335) — `finance.accounts` is the only permission this Phase 1 slice
 * of Finance V2 has registered so far (Owner via `*`, Manager granted,
 * Worker not granted); this route reads the same account set that
 * controller manages, so it reuses that grant rather than introducing a
 * parallel `finance.read` permission for a single route.
 */
@ApiTags('Finance V2')
@ApiBearerAuth()
@Controller('finance/balance')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class BalanceController {
  constructor(private readonly balance: BalanceService) {}

  @Get()
  @RequirePermission('finance.accounts')
  getRakhalBalance(@CurrentFarmId() farmId: string) {
    return this.balance.getRakhalBalance(farmId);
  }
}
