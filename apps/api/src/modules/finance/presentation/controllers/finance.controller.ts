import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReceivableKind } from '@prisma/client';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { FinanceService } from '../../application/services/finance.service';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { CreateFixedAssetDto } from '../dto/create-fixed-asset.dto';
import { LedgerQueryDto, ReceivableQueryDto } from '../dto/finance-query.dto';
import {
  AddFundsDto,
  RecordPaymentDto,
  VoidTransactionDto,
  WithdrawDto,
} from '../dto/finance-actions.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Finance (PRD §16). `/api/v1/finance`. Token tenancy + RBAC (`finance.*`). */
@ApiTags('Finance')
@ApiBearerAuth()
@Controller('finance')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('highlights')
  @RequirePermission('finance.read')
  highlights(@CurrentFarmId() farmId: string) {
    return this.financeService.highlights(farmId);
  }

  @Get('ledger')
  @RequirePermission('finance.read')
  ledger(@CurrentFarmId() farmId: string, @Query() query: LedgerQueryDto) {
    return this.financeService.ledger(farmId, query);
  }

  @Post('transactions')
  @RequirePermission('finance.create')
  record(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.financeService.recordTransaction(farmId, userId, dto);
  }

  @Post('transactions/:id/void')
  @RequirePermission('finance.void')
  void(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: VoidTransactionDto,
  ) {
    return this.financeService.voidTransaction(farmId, userId, id, dto);
  }

  @Get('receivables')
  @RequirePermission('finance.read')
  receivables(
    @CurrentFarmId() farmId: string,
    @Query() query: ReceivableQueryDto,
  ) {
    return this.financeService.receivables(farmId, query);
  }

  @Post('receivables/:id/record-payment')
  @RequirePermission('finance.create')
  recordReceivablePayment(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.financeService.recordPayment(
      farmId,
      ReceivableKind.RECEIVABLE,
      id,
      dto,
    );
  }

  @Get('payables')
  @RequirePermission('finance.read')
  payables(
    @CurrentFarmId() farmId: string,
    @Query() query: ReceivableQueryDto,
  ) {
    return this.financeService.payables(farmId, query);
  }

  @Post('payables/:id/record-payment')
  @RequirePermission('finance.create')
  recordPayablePayment(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.financeService.recordPayment(
      farmId,
      ReceivableKind.PAYABLE,
      id,
      dto,
    );
  }

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

  @Get('wallet')
  @RequirePermission('finance.read')
  wallet(@CurrentFarmId() farmId: string) {
    return this.financeService.wallet(farmId);
  }

  @Post('wallet/add-funds')
  @RequirePermission('finance.create')
  addFunds(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: AddFundsDto,
  ) {
    return this.financeService.addFunds(farmId, userId, dto);
  }

  @Post('wallet/withdraw')
  @RequirePermission('finance.create')
  withdraw(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: WithdrawDto,
  ) {
    return this.financeService.withdraw(farmId, userId, dto);
  }
}
