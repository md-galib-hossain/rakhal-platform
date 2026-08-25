import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SaleService } from '../../application/sale.service';
import { CreateSaleDto } from '../dto/create-sale.dto';

/**
 * Sales module (RAKHAL-339, `FINANCE_V2_DESIGN.md` §4.3, §5.1). Routes resolve
 * under the global prefix as `/api/v1/sales`.
 *
 * Guard chain matches every other Finance V2-adjacent controller (RAKHAL-335/337):
 * JwtAuthGuard → SessionGuard → FarmContextGuard → PermissionGuard →
 * SubscriptionGuard. The active farm is taken from the verified token context,
 * never the body.
 *
 * **Minimal on purpose** — this ticket's scope is the document model, not the full
 * sales UX. Only create + read; no update/cancel/void route (no permission for
 * those actions exists yet either — see `permission-catalogue.ts`'s `sales`
 * resource comment).
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
  constructor(private readonly sales: SaleService) {}

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
  findAll(@CurrentFarmId() farmId: string) {
    return this.sales.findAll(farmId);
  }

  @Get(':id')
  @RequirePermission('sales.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.sales.findOne(farmId, id);
  }
}
