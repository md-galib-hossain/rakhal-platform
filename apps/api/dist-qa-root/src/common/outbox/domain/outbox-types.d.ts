export interface WriteOutboxEventInput {
    farmId: string;
    eventType: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
}
export type OutboxEventHandler = (payload: Record<string, unknown>) => Promise<void> | void;
export interface OutboxDrainResult {
    claimed: number;
    processed: number;
    failed: number;
    deadLettered: number;
}
