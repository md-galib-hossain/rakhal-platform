import { LedgerAccount, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
export declare class LedgerAccountService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    seedDefaultChart(farmId: string, tx?: Prisma.TransactionClient): Promise<void>;
    findAll(farmId: string): Promise<LedgerAccount[]>;
    findByCode(farmId: string, code: string, tx?: Prisma.TransactionClient): Promise<LedgerAccount | null>;
    findByCodeOrSeed(farmId: string, code: string, tx?: Prisma.TransactionClient): Promise<LedgerAccount | null>;
}
