export declare const PURCHASE_NEW_ITEM_KINDS: readonly ["MEDICINE", "FEED", "EQUIPMENT"];
export type PurchaseNewItemKind = (typeof PURCHASE_NEW_ITEM_KINDS)[number];
export interface PurchaseLineDetailInput {
    medicineId?: string | null;
    feedItemId?: string | null;
    equipmentId?: string | null;
    newItem?: {
        kind: string;
        ingredientId?: string | null;
        nutrition?: unknown;
    } | null;
}
export declare function validatePurchaseLineDetailShape(line: PurchaseLineDetailInput): string | null;
