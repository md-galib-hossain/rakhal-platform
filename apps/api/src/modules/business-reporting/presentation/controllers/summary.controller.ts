import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { PeriodSummaryService } from '../../application/period-summary.service';
import { FinanceSummaryQueryDto } from '../dto/finance-summary-query.dto';

/** RAKHAL-370's own precedent (`finance.read`, same guard chain). */
@ApiTags('Business Reporting')
@ApiBearerAuth()
@Controller('finance/summary')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class SummaryController {
  constructor(private readonly periodSummary: PeriodSummaryService) {}

  @Get()
  @RequirePermission('finance.read')
  getSummary(
    @CurrentFarmId() farmId: string,
    @Query() query: FinanceSummaryQueryDto,
  ) {
    return this.periodSummary.getSummary(
      farmId,
      new Date(query.from),
      new Date(query.to),
    );
  }
}
