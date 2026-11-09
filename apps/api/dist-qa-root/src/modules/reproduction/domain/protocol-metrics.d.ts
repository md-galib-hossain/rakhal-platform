export interface InstanceLite {
    status: string;
    aiCompletedAt: Date | null;
    pregnancyOutcome: string | null;
}
export interface ProtocolMetrics {
    applied: number;
    in_progress: number;
    completed: number;
    ai_completed: number;
    pregnant: number;
    open: number;
    pregnancy_loss: number;
    conception_rate: number | null;
}
export declare function summarizeProtocol(instances: InstanceLite[]): ProtocolMetrics;
