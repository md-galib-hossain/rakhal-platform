import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { BillingService } from '../../application/services/billing.service';
import { CheckoutDto } from '../dto/checkout.dto';
import { ListInvoiceQueryDto } from '../dto/list-invoice-query.dto';
import { RefundInvoiceDto } from '../dto/refund-invoice.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Billing (RAKHAL-220, PRD §32). `/api/v1/billing`. Farm chain + RBAC.
 *
 * **Deliberately NOT behind the baseline `SubscriptionGuard`** — billing must
 * stay reachable while a farm is expired so it can pay to recover. Checkout is
 * Owner-only (`subscription.manage`); invoice reads are `subscription.read`.
 * Idempotency via the `Idempotency-Key` header (PAY-05).
 */
@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('checkout')
  @RequirePermission('subscription.manage')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
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

  @Get('invoices/:id/receipt')
  @RequirePermission('subscription.read')
  async receipt(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    // Resolve before touching `res` so not-found / not-paid still flow to the
    // global exception filter. On success we own the raw response (non-passthrough
    // `@Res`), bypassing the JSON envelope, and stream the PDF bytes (TAX-03).
    const file = await this.billing.getReceipt(farmId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
      'Content-Length': String(file.buffer.length),
    });
    res.send(file.buffer);
  }

  @Post('invoices/:id/refund')
  @RequirePermission('subscription.manage')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  refund(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: RefundInvoiceDto,
  ) {
    return this.billing.refundInvoice(farmId, id, userId, dto.reason);
  }
}
