import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { FinanceService } from '../../application/services/finance.service';
import { CreateFixedAssetDto } from '../dto/create-fixed-asset.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Finance V1 survivor (RAKHAL-354): only the Loans/Fixed-Assets read+create
 * surface remains — every other V1 route (`highlights`/`ledger`/
 * `transactions`/`receivables`/`payables`/`wallet/*`) is deleted along with
 * `FinanceTransaction`/`FinanceReceivable`/`WalletTransaction`. See
 * `FinanceService`'s own top doc comment for the full reasoning. `/api/v1/finance`.
 * Token tenancy + RBAC (`finance.*`).
 */
@ApiTags('Finance')
@ApiBearerAuth()
@Controller('finance')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('liabilities')
  @RequirePermission('finance.read')
  liabilities(@CurrentFarmId() farmId: string) {
    return this.financeService.liabilities(farmId);
  }

  @Get('assets')
  @RequirePermission('finance.read')
  assets(@CurrentFarmId() farmId: string) {
    return this.financeService.assets(farmId);
  }

  @Post('assets')
  @RequirePermission('finance.create')
  createAsset(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateFixedAssetDto,
  ) {
    return this.financeService.createFixedAsset(farmId, userId, dto);
  }
}
