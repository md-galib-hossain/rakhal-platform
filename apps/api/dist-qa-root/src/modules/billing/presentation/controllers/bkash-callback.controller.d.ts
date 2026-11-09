import type { Response } from 'express';
import { BillingService } from '../../application/services/billing.service';
export declare class BkashCallbackController {
    private readonly billing;
    constructor(billing: BillingService);
    callback(paymentID: string | undefined, status: string | undefined, res: Response): Promise<void>;
}
