import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
export interface SearchHit {
    id: string;
    label: string;
    sublabel: string | null;
    score: number;
    link: string;
}
export declare class SearchService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    search(farmId: string, rawQuery: string, limit?: number): Promise<{
        query: string;
        results: {
            cattle: SearchHit[];
            tasks: SearchHit[];
            suppliers: SearchHit[];
            buyers: SearchHit[];
            sheds: SearchHit[];
            medicines: SearchHit[];
        };
        total: number;
    }>;
    private searchCattle;
    private searchTasks;
    private searchSuppliers;
    private searchBuyers;
    private searchSheds;
    private searchMedicines;
    private toHits;
}
