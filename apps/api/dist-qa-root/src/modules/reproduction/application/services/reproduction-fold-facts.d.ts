import { Prisma, PrismaClient } from '@prisma/client';
import type { FoldFact } from '../../domain/reproduction-fold';
type Db = PrismaClient | Prisma.TransactionClient;
export declare function loadFoldFacts(db: Db, cattleId: string): Promise<FoldFact[]>;
export {};
