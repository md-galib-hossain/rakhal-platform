import { CalfMilkType } from '@prisma/client';
export declare class RecordMilkFeedingDto {
    date: string;
    morningMl?: number;
    eveningMl?: number;
    type?: CalfMilkType;
    notes?: string;
}
