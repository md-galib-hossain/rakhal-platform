import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { RecordBcsDto } from '../../presentation/dto/record-bcs.dto';
export declare class BcsService {
    private readonly prisma;
    private readonly logger;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    recordBcs(farmId: string, userId: string, cattleId: string, dto: RecordBcsDto): Promise<{
        record: {
            id: string;
            createdAt: Date;
            cattleId: string;
            notes: string | null;
            animalEventId: string | null;
            recordedDate: Date;
            recordedBy: string | null;
            score: number;
        };
        lastBcs: number;
        alerts: import("../../domain/bcs-alerts").BcsAlert[];
    }>;
    history(farmId: string, cattleId: string, limit?: number): Promise<{
        id: string;
        createdAt: Date;
        cattleId: string;
        notes: string | null;
        animalEventId: string | null;
        recordedDate: Date;
        recordedBy: string | null;
        score: number;
    }[]>;
    private computeAlerts;
    private assertCattleInFarm;
}
