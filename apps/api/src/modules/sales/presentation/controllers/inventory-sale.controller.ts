import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SellInventoryUseCase } from '../../application/use-cases/sell-inventory/sell-inventory.use-case';
import { SellInventoryDto } from '../dto/sell-inventory.dto';

/**
 * `POST /sales/inventory` (RAKHAL-376, MILESTONE 22, `BUSINESS_IA_PRD.md`
 * §16.8/§1.4). `SellInventoryUseCase` (RAKHAL-346) has existed since it
 * shipped but was reachable only via `app.get()` in e2e — this is its first
 * real HTTP entry point. Controller + DTO only, no use-case change, same
 * one-atomic-call guarantee `SellInventoryUseCase.execute` already provides.
 * Lives in its own controller (mirrors `AnimalSaleController`'s own
 * precedent) rather than folding into `SaleController`, which stays the
 * generic document-only surface.
 */
@ApiTags('Sales')
@ApiBearerAuth()
@Controller('sales/inventory')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class InventorySaleController {
  constructor(private readonly sellInventory: SellInventoryUseCase) {}

  @Post()
  @RequirePermission('sales.create')
  sell(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: SellInventoryDto,
  ) {
    return this.sellInventory.execute(farmId, userId, dto);
  }
}
