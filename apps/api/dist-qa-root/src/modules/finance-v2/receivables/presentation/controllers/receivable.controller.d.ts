import { ReceivableService } from '../../application/receivable.service';
import { ListReceivablesQueryDto } from '../dto/list-receivables-query.dto';
export declare class ReceivableController {
    private readonly receivables;
    constructor(receivables: ReceivableService);
    list(farmId: string, query: ListReceivablesQueryDto): Promise<import("../../../../../common/pagination").CursorPage<import("../../application/receivable.service").ReceivableWithDerived>>;
    findOne(farmId: string, id: string): Promise<import("../../application/receivable.service").ReceivableWithDerived>;
}
