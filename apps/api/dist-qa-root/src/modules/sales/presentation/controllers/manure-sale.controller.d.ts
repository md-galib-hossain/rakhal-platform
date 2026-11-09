import { RecordManureSaleUseCase } from '../../application/use-cases/sell-manure/record-manure-sale.use-case';
import { SellManureDto } from '../dto/sell-manure.dto';
export declare class ManureSaleController {
    private readonly recordManureSale;
    constructor(recordManureSale: RecordManureSaleUseCase);
    sell(farmId: string, userId: string, dto: SellManureDto): Promise<import("../../application/use-cases/sell-manure/record-manure-sale.use-case").RecordManureSaleResult>;
}
