import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { TransactionFeedService } from '../../application/transaction-feed.service';
import { ListTransactionsQueryDto } from '../dto/list-transactions-query.dto';

/**
 * RAKHAL-370 (MILESTONE 22). Same guard chain / `finance.read` permission
 * every other Finance V2 read route uses — the Transactions screen spans
 * Sales/Purchasing/Payments/Transfers, but lives under the Finance section
 * of the sidebar per the mockups, so it is gated on `finance.read` only
 * rather than requiring both `finance.read` and `purchasing.read`.
 */
@ApiTags('Business Reporting')
@ApiBearerAuth()
@Controller('finance/transactions')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class TransactionController {
  constructor(private readonly transactionFeed: TransactionFeedService) {}

  @Get()
  @RequirePermission('finance.read')
  list(
    @CurrentFarmId() farmId: string,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.transactionFeed.listTransactions(farmId, query);
  }
}
