import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { ProfitLossReportService } from '../../application/reports/profit-loss-report.service';
import { CashFlowReportService } from '../../application/reports/cash-flow-report.service';
import { TrialBalanceReportService } from '../../application/reports/trial-balance-report.service';
import {
  FinanceReportPeriodQueryDto,
  TrialBalanceQueryDto,
} from '../dto/finance-report-query.dto';

/**
 * `GET /finance/reports/*` (RAKHAL-379, MILESTONE 22). Synchronous JSON —
 * deliberately distinct from the existing async job-based Reports module
 * (`rpt_monthly_pl`, CSV/PDF via BullMQ); the Finance Reports tab is an
 * interactive screen, not a download queue. Both catalogues survive
 * unmodified.
 *
 * `profit-loss`/`cash-flow` are `finance.read`-gated, same tier every other
 * business-reporting read route uses. `trial-balance` is gated behind the
 * new owner-only `finance.accounting` permission and is **not** one of the
 * four reports the farmer-facing Reports tab renders (P&L, Cash Flow,
 * Receivable Aging, Payable Aging — the last two already shipped via
 * RAKHAL-369's `receivable-aging.controller.ts`/`payable-aging.controller.ts`)
 * — see `trial-balance-report.service.ts`'s own doc comment for why.
 */
@ApiTags('Business Reporting')
@ApiBearerAuth()
@Controller('finance/reports')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class FinanceReportController {
  constructor(
    private readonly profitLoss: ProfitLossReportService,
    private readonly cashFlow: CashFlowReportService,
    private readonly trialBalance: TrialBalanceReportService,
  ) {}

  @Get('profit-loss')
  @RequirePermission('finance.read')
  getProfitLoss(
    @CurrentFarmId() farmId: string,
    @Query() query: FinanceReportPeriodQueryDto,
  ) {
    return this.profitLoss.getReport(
      farmId,
      new Date(query.from),
      new Date(query.to),
    );
  }

  @Get('cash-flow')
  @RequirePermission('finance.read')
  getCashFlow(
    @CurrentFarmId() farmId: string,
    @Query() query: FinanceReportPeriodQueryDto,
  ) {
    return this.cashFlow.getReport(
      farmId,
      new Date(query.from),
      new Date(query.to),
    );
  }

  @Get('trial-balance')
  @RequirePermission('finance.accounting')
  getTrialBalance(
    @CurrentFarmId() farmId: string,
    @Query() query: TrialBalanceQueryDto,
  ) {
    return this.trialBalance.getReport(
      farmId,
      query.asOf ? new Date(query.asOf) : new Date(),
    );
  }
}
