import { AnimalEventTypeKey } from '../domain/catalogue';
export interface HandlerInput {
    farmId: string;
    userId: string;
    cattleId: string;
    eventAt: Date;
    notes?: string;
    provenance: 'RECORDED' | 'HISTORICAL';
    payload: Record<string, unknown>;
}
export interface HandlerResult {
    animalEventId?: string | null;
    detail: unknown;
    headerData?: Record<string, unknown>;
}
export interface VoidInput {
    farmId: string;
    userId: string;
    cattleId: string;
    animalEventId: string;
    reason: string;
}
export interface EventHandler {
    handle(type: AnimalEventTypeKey, input: HandlerInput): Promise<HandlerResult>;
    voidEvent?(type: AnimalEventTypeKey, input: VoidInput): Promise<boolean>;
    findingsFor?(type: AnimalEventTypeKey, input: Pick<HandlerInput, 'cattleId' | 'payload'>): Promise<string[]>;
}
export declare class EventHandlerRegistry {
    private readonly handlers;
    private readonly recompute;
    onChange(fn: (farmId: string, cattleId: string) => Promise<void>): void;
    recomputeAll(farmId: string, cattleId: string): Promise<void>;
    register(types: AnimalEventTypeKey[], handler: EventHandler): void;
    get(type: string): EventHandler | undefined;
}
