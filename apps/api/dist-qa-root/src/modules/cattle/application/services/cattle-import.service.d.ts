import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CacheService } from 'src/core/cache/cache.service';
import { AnimalEventWriteService } from 'src/modules/animal-events/application/services/animal-event-write.service';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import { ReproductionDerivationService } from 'src/modules/reproduction/application/services/reproduction-derivation.service';
import { ImportConfirmDto } from '../../presentation/dto/import-cattle.dto';
export declare class CattleImportService {
    private readonly prisma;
    private readonly cache;
    private readonly aqrService;
    private readonly derivation;
    private readonly logger;
    private readonly eventWriter?;
    private readonly log;
    constructor(prisma: PrismaService, cache: CacheService, aqrService: AqrService, derivation: ReproductionDerivationService, logger: LoggerService, eventWriter?: AnimalEventWriteService | undefined);
    preview(farmId: string, file: Express.Multer.File | undefined, mappingJson?: string): Promise<{
        importSessionId: `${string}-${string}-${string}-${string}-${string}`;
        total: number;
        ready: number;
        errors: number;
        rows: {
            row: number;
            name: string | null;
            tag: string | null;
            status: "error" | "ready";
            error: string | undefined;
        }[];
    }>;
    confirm(farmId: string, userId: string, dto: ImportConfirmDto): Promise<{
        imported: number;
        skipped: number;
    }>;
    private validateRow;
    private parseWorkbook;
    private cellToString;
    private parseMapping;
    private byLowerName;
    private sessionKey;
    private addDays;
    buildTemplate(): Promise<Buffer>;
}
