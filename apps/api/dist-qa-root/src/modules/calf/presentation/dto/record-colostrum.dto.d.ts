import { ColostrumQuality } from '@prisma/client';
export declare class RecordColostrumDto {
    feedNumber: number;
    fedAt: string;
    volumeMl: number;
    quality?: ColostrumQuality;
    fedBy?: string;
    notes?: string;
}
