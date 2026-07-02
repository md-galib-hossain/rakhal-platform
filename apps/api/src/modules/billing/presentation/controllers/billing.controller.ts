import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { BillingService } from '../../application/services/billing.service';
import { CheckoutDto } from '../dto/checkout.dto';
import { ListInvoiceQueryDto } from '../dto/list-invoice-query.dto';

/**
 * Billing (RAKHAL-220, PRD §32). `/api/v1/billing`. Farm chain + RBAC.
 *
 * **Deliberately NOT behind the baseline `SubscriptionGuard`** — billing must
 * stay reachable while a farm is expired so it can pay to recover. Checkout is
 * Owner-only (`subscription.manage`); invoice reads are `subscription.read`.
 * Idempotency via the `Idempotency-Key` header (PAY-05).
 */
@Controller('billing')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('checkout')
  @RequirePermission('subscription.manage')
  checkout(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CheckoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.billing.checkout(farmId, userId, dto, idempotencyKey);
  }

  @Get('invoices')
  @RequirePermission('subscription.read')
  list(@CurrentFarmId() farmId: string, @Query() query: ListInvoiceQueryDto) {
    return this.billing.listInvoices(farmId, query);
  }

  @Get('invoices/:id')
  @RequirePermission('subscription.read')
  getOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.billing.getInvoice(farmId, id);
  }
}
