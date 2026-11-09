import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CacheService } from 'src/core/cache/cache.service';
import { MilkService } from './milk.service';
import { ImportMilkConfirmDto } from '../../presentation/dto/import-milk.dto';
export declare class MilkImportService {
    private readonly prisma;
    private readonly cache;
    private readonly milkService;
    private readonly log;
    constructor(prisma: PrismaService, cache: CacheService, milkService: MilkService, logger: LoggerService);
    preview(farmId: string, file: Express.Multer.File | undefined): Promise<{
        importSessionId: `${string}-${string}-${string}-${string}-${string}`;
        total: number;
        ready: number;
        errors: number;
        rows: {
            row: number;
            date: string | null;
            tag: string | null;
            status: "error" | "ready";
            error: string | undefined;
        }[];
    }>;
    confirm(farmId: string, userId: string, dto: ImportMilkConfirmDto): Promise<{
        imported: number;
        skipped: number;
        failedGroups: number;
    }>;
    private validateRow;
    private parseWorkbook;
    private cellToString;
    private sessionKey;
}
