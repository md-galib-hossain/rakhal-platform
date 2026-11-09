import { TransactionFeedService } from '../../application/transaction-feed.service';
import { ListTransactionsQueryDto } from '../dto/list-transactions-query.dto';
export declare class TransactionController {
    private readonly transactionFeed;
    constructor(transactionFeed: TransactionFeedService);
    list(farmId: string, query: ListTransactionsQueryDto): Promise<import("../../../../common/pagination").CursorPage<import("../../application/transaction-feed.service").TransactionListRow>>;
}
