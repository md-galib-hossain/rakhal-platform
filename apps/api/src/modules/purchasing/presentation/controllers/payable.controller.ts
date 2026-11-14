import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { PayableService } from '../../application/payable.service';
import { PaySupplierUseCase } from '../../application/use-cases/pay-supplier/pay-supplier.use-case';
import { ListPayablesQueryDto } from '../dto/list-payables-query.dto';
import { PaySupplierDto } from '../dto/pay-supplier.dto';

/**
 * Purchasing module → Payables (RAKHAL-348, `FINANCE_V2_DESIGN.md` §4.3,
 * §4.6, §5.1). Routes resolve under the global prefix as
 * `/api/v1/purchasing/payables`. `Payable` rows themselves are still only
 * ever created by `PurchaseService.createPurchase`/`ExpenseService.
 * recordExpense` — this controller never creates one directly.
 *
 * RAKHAL-376 (MILESTONE 22) added `POST :id/payments` — `PaySupplierUseCase`
 * (RAKHAL-349) had existed since it shipped but was reachable only via
 * `app.get()` in e2e; this is its first real HTTP entry point.
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
  constructor(
    private readonly payables: PayableService,
    private readonly paySupplier: PaySupplierUseCase,
  ) {}

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

  @Post(':id/payments')
  @RequirePermission('purchasing.create')
  pay(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: PaySupplierDto,
  ) {
    return this.paySupplier.execute(farmId, userId, {
      ...dto,
      payableId: id,
    });
  }
}
