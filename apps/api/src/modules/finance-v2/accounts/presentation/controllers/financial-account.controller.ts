import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { FinancialAccountService } from '../../application/financial-account.service';
import { CreateFinancialAccountDto } from '../dto/create-financial-account.dto';
import { UpdateFinancialAccountDto } from '../dto/update-financial-account.dto';

/**
 * Finance V2 → Financial Accounts (RAKHAL-335, `FINANCE_V2_DESIGN.md` §3,
 * §4.4). Routes resolve under the global prefix as `/api/v1/finance/accounts`.
 *
 * Guard chain matches the V1 `FinanceController` this succeeds (token-based
 * tenancy + RBAC, `SubscriptionGuard` gated same as every other finance
 * route): JwtAuthGuard → SessionGuard → FarmContextGuard → PermissionGuard →
 * SubscriptionGuard. The active farm is taken from the verified token
 * context, never the body.
 */
@ApiTags('Finance V2')
@ApiBearerAuth()
@Controller('finance/accounts')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class FinancialAccountController {
  constructor(private readonly accounts: FinancialAccountService) {}

  @Post()
  @RequirePermission('finance.accounts')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateFinancialAccountDto,
  ) {
    return this.accounts.createAccount(farmId, userId, dto);
  }

  @Get()
  @RequirePermission('finance.accounts')
  findAll(@CurrentFarmId() farmId: string) {
    return this.accounts.findAll(farmId);
  }

  @Get(':id')
  @RequirePermission('finance.accounts')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.accounts.findOne(farmId, id);
  }

  @Patch(':id')
  @RequirePermission('finance.accounts')
  update(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialAccountDto,
  ) {
    return this.accounts.updateAccount(farmId, id, dto);
  }

  @Patch(':id/archive')
  @RequirePermission('finance.accounts')
  archive(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.accounts.archiveAccount(farmId, id);
  }
}
