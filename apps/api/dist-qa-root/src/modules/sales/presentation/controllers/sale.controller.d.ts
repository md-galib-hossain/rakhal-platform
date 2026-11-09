import { SaleService } from '../../application/sale.service';
import { VoidSaleUseCase } from '../../application/use-cases/void-sale/void-sale.use-case';
import { CreateSaleDto } from '../dto/create-sale.dto';
import { ListSalesQueryDto } from '../dto/list-sales-query.dto';
export declare class SaleController {
    private readonly sales;
    private readonly voidSale;
    constructor(sales: SaleService, voidSale: VoidSaleUseCase);
    create(farmId: string, userId: string, dto: CreateSaleDto): Promise<{
        lines: ({
            unit: {
                symbol: string;
                name: string;
                farmId: string | null;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                dimension: import("@prisma/client").$Enums.UnitDimension;
                conversionToBase: number | null;
                isSystemDefault: boolean;
            } | null;
            milkDetail: {
                id: string;
                createdAt: Date;
                saleLineId: string;
            } | null;
            animalDetail: {
                id: string;
                createdAt: Date;
                cattleId: string;
                saleLineId: string;
            } | null;
            inventoryDetail: {
                id: string;
                createdAt: Date;
                medicineId: string | null;
                saleLineId: string;
                feedItemId: string | null;
                equipmentId: string | null;
            } | null;
            manureDetail: {
                id: string;
                createdAt: Date;
                notes: string | null;
                saleLineId: string;
            } | null;
        } & {
            type: import("@prisma/client").$Enums.SaleLineType;
            id: string;
            createdAt: Date;
            description: string;
            totalAmount: import("@prisma/client/runtime/client").Decimal;
            saleId: string;
            quantity: import("@prisma/client/runtime/client").Decimal;
            unitId: string | null;
            unitPrice: import("@prisma/client/runtime/client").Decimal;
        })[];
    } & {
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.SaleStatus;
        notes: string | null;
        createdById: string;
        saleNumber: string;
        customerId: string | null;
        saleDate: Date;
        subtotal: import("@prisma/client/runtime/client").Decimal;
        discountAmount: import("@prisma/client/runtime/client").Decimal;
        totalAmount: import("@prisma/client/runtime/client").Decimal;
    }>;
    findAll(farmId: string, query: ListSalesQueryDto): Promise<import("../../../../common/pagination").CursorPage<import("../../application/sale.service").SaleListRow>>;
    findOne(farmId: string, id: string): Promise<{
        lines: ({
            unit: {
                symbol: string;
                name: string;
                farmId: string | null;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                dimension: import("@prisma/client").$Enums.UnitDimension;
                conversionToBase: number | null;
                isSystemDefault: boolean;
            } | null;
            milkDetail: {
                id: string;
                createdAt: Date;
                saleLineId: string;
            } | null;
            animalDetail: {
                id: string;
                createdAt: Date;
                cattleId: string;
                saleLineId: string;
            } | null;
            inventoryDetail: {
                id: string;
                createdAt: Date;
                medicineId: string | null;
                saleLineId: string;
                feedItemId: string | null;
                equipmentId: string | null;
            } | null;
            manureDetail: {
                id: string;
                createdAt: Date;
                notes: string | null;
                saleLineId: string;
            } | null;
        } & {
            type: import("@prisma/client").$Enums.SaleLineType;
            id: string;
            createdAt: Date;
            description: string;
            totalAmount: import("@prisma/client/runtime/client").Decimal;
            saleId: string;
            quantity: import("@prisma/client/runtime/client").Decimal;
            unitId: string | null;
            unitPrice: import("@prisma/client/runtime/client").Decimal;
        })[];
    } & {
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.SaleStatus;
        notes: string | null;
        createdById: string;
        saleNumber: string;
        customerId: string | null;
        saleDate: Date;
        subtotal: import("@prisma/client/runtime/client").Decimal;
        discountAmount: import("@prisma/client/runtime/client").Decimal;
        totalAmount: import("@prisma/client/runtime/client").Decimal;
    }>;
    cancel(farmId: string, userId: string, id: string): Promise<{
        lines: ({
            unit: {
                symbol: string;
                name: string;
                farmId: string | null;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                dimension: import("@prisma/client").$Enums.UnitDimension;
                conversionToBase: number | null;
                isSystemDefault: boolean;
            } | null;
            milkDetail: {
                id: string;
                createdAt: Date;
                saleLineId: string;
            } | null;
            animalDetail: {
                id: string;
                createdAt: Date;
                cattleId: string;
                saleLineId: string;
            } | null;
            inventoryDetail: {
                id: string;
                createdAt: Date;
                medicineId: string | null;
                saleLineId: string;
                feedItemId: string | null;
                equipmentId: string | null;
            } | null;
            manureDetail: {
                id: string;
                createdAt: Date;
                notes: string | null;
                saleLineId: string;
            } | null;
        } & {
            type: import("@prisma/client").$Enums.SaleLineType;
            id: string;
            createdAt: Date;
            description: string;
            totalAmount: import("@prisma/client/runtime/client").Decimal;
            saleId: string;
            quantity: import("@prisma/client/runtime/client").Decimal;
            unitId: string | null;
            unitPrice: import("@prisma/client/runtime/client").Decimal;
        })[];
    } & {
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.SaleStatus;
        notes: string | null;
        createdById: string;
        saleNumber: string;
        customerId: string | null;
        saleDate: Date;
        subtotal: import("@prisma/client/runtime/client").Decimal;
        discountAmount: import("@prisma/client/runtime/client").Decimal;
        totalAmount: import("@prisma/client/runtime/client").Decimal;
    }>;
    refund(farmId: string, userId: string, id: string): Promise<{
        lines: ({
            unit: {
                symbol: string;
                name: string;
                farmId: string | null;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                dimension: import("@prisma/client").$Enums.UnitDimension;
                conversionToBase: number | null;
                isSystemDefault: boolean;
            } | null;
            milkDetail: {
                id: string;
                createdAt: Date;
                saleLineId: string;
            } | null;
            animalDetail: {
                id: string;
                createdAt: Date;
                cattleId: string;
                saleLineId: string;
            } | null;
            inventoryDetail: {
                id: string;
                createdAt: Date;
                medicineId: string | null;
                saleLineId: string;
                feedItemId: string | null;
                equipmentId: string | null;
            } | null;
            manureDetail: {
                id: string;
                createdAt: Date;
                notes: string | null;
                saleLineId: string;
            } | null;
        } & {
            type: import("@prisma/client").$Enums.SaleLineType;
            id: string;
            createdAt: Date;
            description: string;
            totalAmount: import("@prisma/client/runtime/client").Decimal;
            saleId: string;
            quantity: import("@prisma/client/runtime/client").Decimal;
            unitId: string | null;
            unitPrice: import("@prisma/client/runtime/client").Decimal;
        })[];
    } & {
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.SaleStatus;
        notes: string | null;
        createdById: string;
        saleNumber: string;
        customerId: string | null;
        saleDate: Date;
        subtotal: import("@prisma/client/runtime/client").Decimal;
        discountAmount: import("@prisma/client/runtime/client").Decimal;
        totalAmount: import("@prisma/client/runtime/client").Decimal;
    }>;
}
