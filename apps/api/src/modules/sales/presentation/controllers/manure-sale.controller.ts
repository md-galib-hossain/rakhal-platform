import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { RecordManureSaleUseCase } from '../../application/use-cases/sell-manure/record-manure-sale.use-case';
import { SellManureDto } from '../dto/sell-manure.dto';

/**
 * `POST /sales/manure` (RAKHAL-376, MILESTONE 22, `BUSINESS_IA_PRD.md`
 * §16.8/§1.4). `RecordManureSaleUseCase` (RAKHAL-347) has existed since it
 * shipped but was reachable only via `app.get()` in e2e — this is its first
 * real HTTP entry point. Lives in `SellManureModule` (not `SalesModule`,
 * same "own module's controller" precedent `SellAnimalModule`/
 * `AnimalSaleController` already set) since that is where
 * `RecordManureSaleUseCase` is provided.
 */
@ApiTags('Sales')
@ApiBearerAuth()
@Controller('sales/manure')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class ManureSaleController {
  constructor(private readonly recordManureSale: RecordManureSaleUseCase) {}

  @Post()
  @RequirePermission('sales.create')
  sell(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: SellManureDto,
  ) {
    return this.recordManureSale.execute(farmId, userId, dto);
  }
}
