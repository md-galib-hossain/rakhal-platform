import { AgingService } from '../../application/aging.service';
import { AgingQueryDto } from '../dto/aging-query.dto';
export declare class ReceivableAgingController {
    private readonly aging;
    constructor(aging: AgingService);
    getAging(farmId: string, query: AgingQueryDto): Promise<import("../../application/aging.service").AgingReport>;
}
