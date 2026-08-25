import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { TransferService } from '../../application/transfer.service';
import { CreateTransferDto } from '../dto/create-transfer.dto';

/**
 * Finance V2 → Transfers (RAKHAL-338, `FINANCE_V2_DESIGN.md` §4.4). Routes
 * resolve under the global prefix as `/api/v1/finance/transfers`.
 *
 * Guard chain matches every other Finance V2 controller (RAKHAL-335/336/337):
 * JwtAuthGuard → SessionGuard → FarmContextGuard → PermissionGuard →
 * SubscriptionGuard. The active farm is taken from the verified token
 * context, never the body. Gated on the new `finance.transfer` permission
 * (Owner via `*`, Manager granted, Worker not) — moving money between
 * accounts is an Owner/Manager action, same tier as Financial Accounts
 * (`finance.accounts`).
 */
@ApiTags('Finance V2')
@ApiBearerAuth()
@Controller('finance/transfers')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class TransferController {
  constructor(private readonly transfers: TransferService) {}

  @Post()
  @RequirePermission('finance.transfer')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateTransferDto,
  ) {
    return this.transfers.createTransfer(farmId, userId, dto);
  }

  @Get()
  @RequirePermission('finance.transfer')
  findAll(@CurrentFarmId() farmId: string) {
    return this.transfers.findAll(farmId);
  }

  @Get(':id')
  @RequirePermission('finance.transfer')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.transfers.findOne(farmId, id);
  }
}
