import { SupplierReadService } from '../../application/supplier-read.service';
export declare class SupplierReadController {
    private readonly suppliers;
    constructor(suppliers: SupplierReadService);
    list(farmId: string): Promise<import("../../application/supplier-read.service").SupplierListRow[]>;
    summary(farmId: string): Promise<import("../../application/supplier-read.service").SupplierSummary>;
}
