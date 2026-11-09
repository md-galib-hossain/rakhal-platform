import { type AnimalEventTypeKey } from '../../domain/catalogue';
import { FollowUpToggleDto } from './record-event.dto';
export declare class BulkEventDto {
    type: AnimalEventTypeKey;
    eventAt: string;
    provenance?: 'RECORDED' | 'HISTORICAL';
    notes?: string;
    customTypeId?: string;
    payload?: Record<string, unknown>;
    values?: Record<string, Record<string, unknown>>;
    cattleIds: string[];
    mode?: 'skipIneligible' | 'allOrNothing';
    category?: string;
    followUps?: FollowUpToggleDto[];
}
