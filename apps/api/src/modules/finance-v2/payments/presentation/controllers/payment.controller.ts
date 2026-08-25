import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { PaymentService } from '../../application/payment.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { AllocatePaymentDto } from '../dto/allocate-payment.dto';

/**
 * Finance V2 → Payments (RAKHAL-337, `FINANCE_V2_DESIGN.md` §4.5, §4.6).
 * Routes resolve under the global prefix as `/api/v1/finance/payments`.
 *
 * Guard chain matches every other Finance V2 controller (RAKHAL-335/336):
 * JwtAuthGuard → SessionGuard → FarmContextGuard → PermissionGuard →
 * SubscriptionGuard. The active farm is taken from the verified token
 * context, never the body.
 */
@ApiTags('Finance V2')
@ApiBearerAuth()
@Controller('finance/payments')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Post()
  @RequirePermission('finance.create')
  record(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.payments.recordPayment(farmId, userId, dto);
  }

  @Get()
  @RequirePermission('finance.read')
  findAll(@CurrentFarmId() farmId: string) {
    return this.payments.findAll(farmId);
  }

  @Get(':id')
  @RequirePermission('finance.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.payments.findOne(farmId, id);
  }

  @Post(':id/allocations')
  @RequirePermission('finance.create')
  allocate(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: AllocatePaymentDto,
  ) {
    return this.payments.allocatePayment(farmId, id, dto.allocations);
  }
}
