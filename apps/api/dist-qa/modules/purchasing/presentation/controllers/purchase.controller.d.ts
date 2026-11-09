import { PurchaseService } from '../../application/purchase.service';
import { VoidDocumentUseCase } from '../../application/use-cases/void-document/void-document.use-case';
import { CreatePurchaseDto } from '../dto/create-purchase.dto';
import { ListPurchasesQueryDto } from '../dto/list-purchases-query.dto';
export declare class PurchaseController {
    private readonly purchases;
    private readonly voidDocument;
    constructor(purchases: PurchaseService, voidDocument: VoidDocumentUseCase);
    create(farmId: string, userId: string, dto: CreatePurchaseDto): Promise<{
        payable: {
            farmId: string;
            id: string;
            createdAt: Date;
            totalAmount: import("@prisma/client/runtime/client").Decimal;
            supplierId: string | null;
            dueDate: Date | null;
            closedAt: Date | null;
            purchaseId: string | null;
            expenseId: string | null;
        } | null;
        lines: {
            id: string;
            createdAt: Date;
            totalAmount: import("@prisma/client/runtime/client").Decimal;
            quantity: import("@prisma/client/runtime/client").Decimal;
            medicineId: string | null;
            medicineBatchId: string | null;
            feedItemId: string | null;
            feedItemBatchId: string | null;
            equipmentId: string | null;
            unitCost: import("@prisma/client/runtime/client").Decimal;
            purchaseId: string;
        }[];
    } & {
        farmId: string;
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.PurchaseStatus;
        notes: string | null;
        createdById: string;
        totalAmount: import("@prisma/client/runtime/client").Decimal;
        purchaseNumber: string;
        supplierId: string | null;
        purchaseDate: Date;
    }>;
    findAll(farmId: string, query: ListPurchasesQueryDto): Promise<import("../../../../common/pagination").CursorPage<import("../../application/purchase.service").PurchaseListRow>>;
    findOne(farmId: string, id: string): Promise<{
        payable: {
            farmId: string;
            id: string;
            createdAt: Date;
            totalAmount: import("@prisma/client/runtime/client").Decimal;
            supplierId: string | null;
            dueDate: Date | null;
            closedAt: Date | null;
            purchaseId: string | null;
            expenseId: string | null;
        } | null;
        lines: {
            id: string;
            createdAt: Date;
            totalAmount: import("@prisma/client/runtime/client").Decimal;
            quantity: import("@prisma/client/runtime/client").Decimal;
            medicineId: string | null;
            medicineBatchId: string | null;
            feedItemId: string | null;
            feedItemBatchId: string | null;
            equipmentId: string | null;
            unitCost: import("@prisma/client/runtime/client").Decimal;
            purchaseId: string;
        }[];
    } & {
        farmId: string;
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.PurchaseStatus;
        notes: string | null;
        createdById: string;
        totalAmount: import("@prisma/client/runtime/client").Decimal;
        purchaseNumber: string;
        supplierId: string | null;
        purchaseDate: Date;
    }>;
    void(farmId: string, userId: string, id: string): Promise<{
        payable: {
            farmId: string;
            id: string;
            createdAt: Date;
            totalAmount: import("@prisma/client/runtime/client").Decimal;
            supplierId: string | null;
            dueDate: Date | null;
            closedAt: Date | null;
            purchaseId: string | null;
            expenseId: string | null;
        } | null;
        lines: {
            id: string;
            createdAt: Date;
            totalAmount: import("@prisma/client/runtime/client").Decimal;
            quantity: import("@prisma/client/runtime/client").Decimal;
            medicineId: string | null;
            medicineBatchId: string | null;
            feedItemId: string | null;
            feedItemBatchId: string | null;
            equipmentId: string | null;
            unitCost: import("@prisma/client/runtime/client").Decimal;
            purchaseId: string;
        }[];
    } & {
        farmId: string;
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.PurchaseStatus;
        notes: string | null;
        createdById: string;
        totalAmount: import("@prisma/client/runtime/client").Decimal;
        purchaseNumber: string;
        supplierId: string | null;
        purchaseDate: Date;
    }>;
}
