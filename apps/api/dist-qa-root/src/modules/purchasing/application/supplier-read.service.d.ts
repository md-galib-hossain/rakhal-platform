import { PrismaService } from 'src/core/database/prisma/prisma.service';
export interface SupplierListRow {
    id: string;
    name: string;
    phone: string | null;
    totalPurchases: string;
    payable: string;
    lastPurchaseAt: string | null;
    status: 'ACTIVE' | 'INACTIVE';
}
export interface SupplierSummary {
    totalCount: number;
    activeCount: number;
    totalPurchases: string;
    totalPayable: string;
}
export declare class SupplierReadService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listSuppliers(farmId: string): Promise<SupplierListRow[]>;
    getSummary(farmId: string): Promise<SupplierSummary>;
    private purchaseAggBySupplier;
    private payableOutstandingBySupplier;
}
