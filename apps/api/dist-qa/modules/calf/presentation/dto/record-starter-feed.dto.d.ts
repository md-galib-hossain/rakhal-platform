import { CalfStarterEventType } from '@prisma/client';
export declare class RecordStarterFeedDto {
    date: string;
    eventType: CalfStarterEventType;
    amountG?: number;
    notes?: string;
}
