import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { IncomeService } from '../../application/income.service';
import { CreateIncomeCategoryDto } from '../dto/create-income-category.dto';
import { RecordOtherIncomeDto } from '../dto/record-other-income.dto';
import { ApiEnvelopeResponse } from 'src/common/swagger/api-envelope';
import {
  IncomeCategoryResponseDto,
  IncomeResponseDto,
} from 'src/modules/finance-v2/presentation/dto/finance-response.dto';

/**
 * Finance V2 → Other Income (RAKHAL-350, `FINANCE_V2_DESIGN.md` §1.3, §5.1).
 * Routes resolve under the global prefix as `/api/v1/finance/income*`.
 *
 * Guard chain matches every other Finance V2 controller (RAKHAL-335/337/340):
 * JwtAuthGuard → SessionGuard → FarmContextGuard → PermissionGuard →
 * SubscriptionGuard. The active farm is taken from the verified token
 * context, never a body param.
 *
 * Reuses `finance.read`/`finance.create` — the same permission keys
 * `PaymentController`/`FinancialAccountController` already gate this tier of
 * finance data with — rather than inventing a new key, per this ticket's own
 * scoping note (align with the majority RAKHAL-337/339/340/348 pattern).
 */
@ApiTags('Finance V2')
@ApiBearerAuth()
@Controller('finance/income')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class IncomeController {
  constructor(private readonly income: IncomeService) {}

  @Get('categories')
  @RequirePermission('finance.read')
  @ApiEnvelopeResponse(IncomeCategoryResponseDto, { isArray: true })
  listCategories(@CurrentFarmId() farmId: string) {
    return this.income.listCategories(farmId);
  }

  @Post('categories')
  @RequirePermission('finance.create')
  @ApiEnvelopeResponse(IncomeCategoryResponseDto, { status: 201 })
  createCategory(
    @CurrentFarmId() farmId: string,
    @Body() dto: CreateIncomeCategoryDto,
  ) {
    return this.income.createCategory(farmId, dto);
  }

  @Post()
  @RequirePermission('finance.create')
  @ApiEnvelopeResponse(IncomeResponseDto, { status: 201 })
  record(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: RecordOtherIncomeDto,
  ) {
    return this.income.recordOtherIncome(farmId, userId, dto);
  }

  @Get()
  @RequirePermission('finance.read')
  @ApiEnvelopeResponse(IncomeResponseDto, { isArray: true })
  findAll(@CurrentFarmId() farmId: string) {
    return this.income.findAll(farmId);
  }

  @Get(':id')
  @RequirePermission('finance.read')
  @ApiEnvelopeResponse(IncomeResponseDto)
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.income.findOne(farmId, id);
  }
}
