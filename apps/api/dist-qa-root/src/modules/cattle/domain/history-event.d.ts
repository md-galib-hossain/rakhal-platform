import type { AnimalEventTypeKey } from 'src/modules/animal-events/domain/catalogue';
import type { HistoryItemDto } from '../presentation/dto/intake.dto';
export declare function historyEvent(h: HistoryItemDto): {
    type: AnimalEventTypeKey;
    eventAt: string;
    payload: Record<string, unknown>;
} | null;
