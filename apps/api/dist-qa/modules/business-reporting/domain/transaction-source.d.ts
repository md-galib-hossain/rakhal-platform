export interface TransactionSourceDescriptor {
    label: string;
    buildHref: (sourceId: string) => string | null;
}
export declare const TRANSACTION_SOURCE_REGISTRY: Record<string, TransactionSourceDescriptor>;
export declare const PARTY_RESOLVABLE_SOURCE_TYPES: readonly ["SALE", "PURCHASE", "EXPENSE"];
export declare function describeSourceType(sourceType: string): TransactionSourceDescriptor;
