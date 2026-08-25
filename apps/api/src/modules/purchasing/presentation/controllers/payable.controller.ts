import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { PayableService } from '../../application/payable.service';
import { ListPayablesQueryDto } from '../dto/list-payables-query.dto';

/**
 * Purchasing module → Payables (RAKHAL-348, `FINANCE_V2_DESIGN.md` §4.3,
 * §4.6, §5.1). Routes resolve under the global prefix as
 * `/api/v1/purchasing/payables`. Read-only surface — `Payable` rows are
 * created by `PurchaseService.createPurchase`/`ExpenseService.recordExpense`,
 * never directly via this controller — mirrors `ReceivableController`
 * exactly.
 */
@ApiTags('Purchasing')
@ApiBearerAuth()
@Controller('purchasing/payables')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class PayableController {
  constructor(private readonly payables: PayableService) {}

  @Get()
  @RequirePermission('purchasing.read')
  list(@CurrentFarmId() farmId: string, @Query() query: ListPayablesQueryDto) {
    return this.payables.listPayables(farmId, query);
  }

  @Get(':id')
  @RequirePermission('purchasing.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.payables.findOne(farmId, id);
  }
}
