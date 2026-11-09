import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { ExportMilkLogDto } from '../../presentation/dto/export-milk-log.dto';
export declare class MilkExportService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    exportLog(farmId: string, dto: ExportMilkLogDto): Promise<{
        buffer: Buffer;
        filename: string;
    }>;
    private normalizeDate;
}
