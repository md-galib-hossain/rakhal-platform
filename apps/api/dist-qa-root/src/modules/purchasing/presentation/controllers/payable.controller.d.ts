import { PayableService } from '../../application/payable.service';
import { PaySupplierUseCase } from '../../application/use-cases/pay-supplier/pay-supplier.use-case';
import { ListPayablesQueryDto } from '../dto/list-payables-query.dto';
import { PaySupplierDto } from '../dto/pay-supplier.dto';
export declare class PayableController {
    private readonly payables;
    private readonly paySupplier;
    constructor(payables: PayableService, paySupplier: PaySupplierUseCase);
    list(farmId: string, query: ListPayablesQueryDto): Promise<import("../../../../common/pagination").CursorPage<import("../../application/payable.service").PayableWithDerived>>;
    findOne(farmId: string, id: string): Promise<import("../../application/payable.service").PayableWithDerived>;
    pay(farmId: string, userId: string, id: string, dto: PaySupplierDto): Promise<import("../../application/use-cases/pay-supplier/pay-supplier.use-case").PaySupplierResult>;
}
