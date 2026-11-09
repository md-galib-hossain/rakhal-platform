export type CreditSpendSurface = 'subscription' | 'consultation' | 'marketplace' | 'cattle_trade';
export interface CreditPolicy {
    cashOutEnabled: boolean;
    spendableSurfaces: CreditSpendSurface[];
}
export declare const DEFAULT_CREDIT_POLICY: CreditPolicy;
