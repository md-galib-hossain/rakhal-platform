export declare const EXPIRY_SOON_DAYS = 30;
export type StockStatus = 'out' | 'low' | 'adequate';
export type ExpiryStatus = 'expired' | 'expiring_soon' | 'ok';
export declare function computeStockStatus(currentStock: number, lowStockThreshold: number): StockStatus;
export declare function computeExpiryStatus(expiryDate: Date, now?: Date): ExpiryStatus;
export declare function isExpired(expiryDate: Date, now?: Date): boolean;
