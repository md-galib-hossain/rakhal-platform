import { type AnimalEventTypeKey } from '../../domain/catalogue';
export declare class FollowUpToggleDto {
    ruleKey: string;
    enabled: boolean;
}
export declare class RecordEventDto {
    type: AnimalEventTypeKey;
    eventAt: string;
    provenance?: 'RECORDED' | 'HISTORICAL';
    notes?: string;
    customTypeId?: string;
    sourceEventId?: string;
    payload?: Record<string, unknown>;
    followUps?: FollowUpToggleDto[];
}
