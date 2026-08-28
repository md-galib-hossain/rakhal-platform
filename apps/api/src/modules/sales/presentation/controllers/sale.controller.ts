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
import { SaleService } from '../../application/sale.service';
import { VoidSaleUseCase } from '../../application/use-cases/void-sale/void-sale.use-case';
import { CreateSaleDto } from '../dto/create-sale.dto';
import { ListSalesQueryDto } from '../dto/list-sales-query.dto';

/**
 * Sales module (RAKHAL-339, `FINANCE_V2_DESIGN.md` §4.3, §5.1). Routes resolve
 * under the global prefix as `/api/v1/sales`.
 *
 * Guard chain matches every other Finance V2-adjacent controller (RAKHAL-335/337):
 * JwtAuthGuard → SessionGuard → FarmContextGuard → PermissionGuard →
 * SubscriptionGuard. The active farm is taken from the verified token context,
 * never the body.
 *
 * RAKHAL-377 (MILESTONE 22) added `POST :id/cancel`/`POST :id/refund` —
 * `finance.reverse` (owner-only), the only correction mechanism for a posted
 * `Sale` (`JournalTransaction` immutability forbids a money-changing `PATCH`,
 * see `VoidSaleUseCase`'s own doc comment).
 */
@ApiTags('Sales')
@ApiBearerAuth()
@Controller('sales')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class SaleController {
  constructor(
    private readonly sales: SaleService,
    private readonly voidSale: VoidSaleUseCase,
  ) {}

  @Post()
  @RequirePermission('sales.create')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateSaleDto,
  ) {
    return this.sales.createSale(farmId, userId, dto);
  }

  @Get()
  @RequirePermission('sales.read')
  findAll(@CurrentFarmId() farmId: string, @Query() query: ListSalesQueryDto) {
    return this.sales.findAll(farmId, query);
  }

  @Get(':id')
  @RequirePermission('sales.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.sales.findOne(farmId, id);
  }

  @Post(':id/cancel')
  @RequirePermission('finance.reverse')
  cancel(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.voidSale.cancelSale(farmId, userId, id);
  }

  @Post(':id/refund')
  @RequirePermission('finance.reverse')
  refund(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.voidSale.refundSale(farmId, userId, id);
  }
}
