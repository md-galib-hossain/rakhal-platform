import { JournalEntry, JournalTransaction, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { MoneyInput } from 'src/common/money';
export type JournalTransactionWithEntries = JournalTransaction & {
    entries: JournalEntry[];
};
export interface PostJournalLine {
    ledgerAccountId: string;
    debit?: MoneyInput;
    credit?: MoneyInput;
}
export interface PostJournalInput {
    farmId: string;
    sourceType: string;
    sourceId: string;
    transactionDate: Date;
    description: string;
    idempotencyKey: string;
    createdById: string;
    entries: PostJournalLine[];
}
export interface ReverseJournalInput {
    farmId: string;
    journalTransactionId: string;
    createdById: string;
    idempotencyKey: string;
    description?: string;
    transactionDate?: Date;
}
export declare class JournalService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    postJournal(input: PostJournalInput, tx?: Prisma.TransactionClient): Promise<JournalTransactionWithEntries>;
    private postWithClient;
    reverseJournal(input: ReverseJournalInput, tx?: Prisma.TransactionClient): Promise<JournalTransactionWithEntries>;
    private reverseWithClient;
    findById(farmId: string, journalTransactionId: string): Promise<JournalTransactionWithEntries | null>;
}
