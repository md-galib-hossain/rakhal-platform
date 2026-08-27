import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { PurchasingSummaryService } from '../../application/purchasing-summary.service';
import { PurchasingSummaryQueryDto } from '../dto/purchasing-summary-query.dto';

/** `SummaryController`'s (`finance/summary`) own precedent — `purchasing.read`,
 * same guard chain, matches `purchase.controller.ts`'s existing read routes. */
@ApiTags('Business Reporting')
@ApiBearerAuth()
@Controller('purchasing/summary')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class PurchasingSummaryController {
  constructor(private readonly purchasingSummary: PurchasingSummaryService) {}

  @Get()
  @RequirePermission('purchasing.read')
  getSummary(
    @CurrentFarmId() farmId: string,
    @Query() query: PurchasingSummaryQueryDto,
  ) {
    return this.purchasingSummary.getSummary(
      farmId,
      new Date(query.from),
      new Date(query.to),
    );
  }
}
