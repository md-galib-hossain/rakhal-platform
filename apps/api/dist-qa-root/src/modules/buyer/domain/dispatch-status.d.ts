export type DispatchStatus = 'PENDING' | 'DELIVERED' | 'CANCELLED';
export interface DispatchStatusInput {
    cancelledAt: Date | null;
    volumeReceivedL: number | null;
}
export declare function deriveDispatchStatus(dispatch: DispatchStatusInput): DispatchStatus;
export declare function assertDispatchCancellable(dispatch: {
    saleId: string | null;
    cancelledAt: Date | null;
}): void;
