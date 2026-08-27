import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SalesSummaryService } from '../../application/sales-summary.service';
import { SalesSummaryQueryDto } from '../dto/sales-summary-query.dto';

/** `SummaryController`'s (`finance/summary`) own precedent — `sales.read`,
 * same guard chain, matches `sale.controller.ts`'s existing read routes. */
@ApiTags('Business Reporting')
@ApiBearerAuth()
@Controller('sales/summary')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class SalesSummaryController {
  constructor(private readonly salesSummary: SalesSummaryService) {}

  @Get()
  @RequirePermission('sales.read')
  getSummary(
    @CurrentFarmId() farmId: string,
    @Query() query: SalesSummaryQueryDto,
  ) {
    return this.salesSummary.getSummary(
      farmId,
      new Date(query.from),
      new Date(query.to),
      query.granularity ?? 'day',
    );
  }
}
