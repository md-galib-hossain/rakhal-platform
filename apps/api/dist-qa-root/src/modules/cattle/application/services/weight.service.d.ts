import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { RecordWeightDto } from '../../presentation/dto/record-weight.dto';
export type WeightHistoryPeriod = 'day' | 'week' | 'month' | 'year';
export interface WeightHistoryPoint {
    date: string;
    weightKg: number;
}
export declare class WeightService {
    private readonly prisma;
    private readonly logger;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    recordWeight(farmId: string, userId: string, cattleId: string, dto: RecordWeightDto): Promise<{
        record: {
            id: string;
            createdAt: Date;
            cattleId: string;
            notes: string | null;
            animalEventId: string | null;
            recordedDate: Date;
            weightKg: number;
            recordedBy: string | null;
        };
        lastWeightKg: number;
    }>;
    history(farmId: string, cattleId: string, limit?: number): Promise<{
        id: string;
        createdAt: Date;
        cattleId: string;
        notes: string | null;
        animalEventId: string | null;
        recordedDate: Date;
        weightKg: number;
        recordedBy: string | null;
    }[]>;
    periodHistory(farmId: string, cattleId: string, period?: WeightHistoryPeriod): Promise<{
        period: WeightHistoryPeriod;
        points: WeightHistoryPoint[];
    }>;
    private periodWindowStart;
    private bucketKey;
    private assertCattleInFarm;
}
