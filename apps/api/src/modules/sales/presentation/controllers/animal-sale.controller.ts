import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SellAnimalUseCase } from '../../application/use-cases/sell-animal/sell-animal.use-case';
import { SellAnimalDto } from '../dto/sell-animal.dto';

/**
 * `POST /sales/animal/:cattleId` (RAKHAL-357/399) — the real HTTP entry
 * point `SellAnimalUseCase` (RAKHAL-345) has been missing since it was
 * built: until now the frontend's "Sell" action on the cattle detail sheet
 * posted to the generic `POST /sales`, which only persists a bare `Sale`
 * document — no `CattleDisposition`, no `herdStatus` flip, no ledger
 * posting. This route is the one place that actually disposes a sold
 * animal. Lives in its own controller (not `SaleController`) because
 * `SellAnimalModule` already owns the `SellAnimalUseCase` provider and
 * importing `SalesModule` back into it would cycle.
 */
@ApiTags('Sales')
@ApiBearerAuth()
@Controller('sales/animal')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class AnimalSaleController {
  constructor(private readonly sellAnimal: SellAnimalUseCase) {}

  @Post(':cattleId')
  @RequirePermission('sales.create')
  sell(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('cattleId') cattleId: string,
    @Body() dto: SellAnimalDto,
  ) {
    return this.sellAnimal.execute(farmId, userId, cattleId, dto);
  }
}
