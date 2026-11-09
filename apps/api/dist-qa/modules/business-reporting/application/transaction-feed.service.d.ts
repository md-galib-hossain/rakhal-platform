import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { CursorPage } from 'src/common/pagination';
import { ListTransactionsQueryDto } from '../presentation/dto/list-transactions-query.dto';
export interface TransactionListRow {
    id: string;
    transactionDate: string;
    type: string;
    typeLabel: string;
    reference: string | null;
    party: {
        id: string;
        name: string;
    } | null;
    accounts: string[];
    amount: string;
    cashAmount: string;
    status: 'POSTED' | 'REVERSED';
    createdBy: string | null;
    source: {
        type: string;
        id: string;
        label: string;
        href: string | null;
    };
}
export declare class TransactionFeedService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listTransactions(farmId: string, query: ListTransactionsQueryDto): Promise<CursorPage<TransactionListRow>>;
    private resolveParties;
}
