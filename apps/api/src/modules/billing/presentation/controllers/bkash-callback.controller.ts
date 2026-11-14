import { Controller, Get, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { env } from 'src/core/config/env';
import { BillingService } from '../../application/services/billing.service';
import { ApiTags } from '@nestjs/swagger';

/**
 * bKash return/callback (RAKHAL-221, PRD §32.3). bKash redirects the payer's
 * browser here after approval — there's **no auth token**, so this controller is
 * deliberately unguarded. It re-executes the payment through the gateway (never
 * trusts the callback, PAY-02) and redirects the user to the frontend return URL
 * with the outcome. Forging a `paymentID` can't mint a PAID invoice: finalize
 * only acts on a Payment we created and requires a gateway-confirmed COMPLETED.
 * Rate-limited (RAKHAL-224) so the public, unauthenticated route can't be abused
 * to hammer the gateway with forged paymentIDs.
 */
@ApiTags('Billing')
@Controller('billing/bkash')
export class BkashCallbackController {
  constructor(private readonly billing: BillingService) {}

  @Get('callback')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async callback(
    @Query('paymentID') paymentID: string | undefined,
    @Query('status') status: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    let outcome = 'failed';
    if (status === 'success' && paymentID) {
      const result = await this.billing.finalizePayment(paymentID);
      outcome =
        result.status === 'PAID' || result.status === 'ALREADY_PAID'
          ? 'success'
          : 'failed';
    }
    const sep = env.BKASH_RETURN_URL.includes('?') ? '&' : '?';
    res.redirect(`${env.BKASH_RETURN_URL}${sep}status=${outcome}`);
  }
}
