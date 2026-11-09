import { MilkSession } from '@prisma/client';
export declare class MilkLogEntryDto {
    cattleId: string;
    yieldL: number;
    anomalyNote?: string;
    tankId?: string;
    editReason?: string;
}
export declare class SaveMilkLogDto {
    date: string;
    session: MilkSession;
    entries: MilkLogEntryDto[];
}
