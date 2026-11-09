import { EquipmentService } from '../../application/services/equipment.service';
import { BulkDeleteEquipmentDto } from '../dto/bulk-delete-equipment.dto';
import { CreateEquipmentDto } from '../dto/create-equipment.dto';
import { ListEquipmentQueryDto } from '../dto/list-equipment-query.dto';
import { UpdateEquipmentDto } from '../dto/update-equipment.dto';
export declare class EquipmentController {
    private readonly equipmentService;
    constructor(equipmentService: EquipmentService);
    create(farmId: string, userId: string, dto: CreateEquipmentDto): Promise<{
        type: import("@prisma/client").$Enums.EquipmentType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        notes: string | null;
        createdBy: string;
        purchaseDate: Date;
        unitId: string | null;
        assetId: string | null;
        currentStock: number;
        costPerUnit: number;
        lowStockThreshold: number;
    } & {
        unit: import("@prisma/client").Unit | null;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
    }>;
    bulkDelete(farmId: string, userId: string, dto: BulkDeleteEquipmentDto): Promise<{
        deleted: number;
    }>;
    findAll(farmId: string, query: ListEquipmentQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        type: import("@prisma/client").$Enums.EquipmentType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        notes: string | null;
        createdBy: string;
        purchaseDate: Date;
        unitId: string | null;
        assetId: string | null;
        currentStock: number;
        costPerUnit: number;
        lowStockThreshold: number;
    } & {
        unit: import("@prisma/client").Unit | null;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
    }>>;
    findOne(farmId: string, id: string): Promise<{
        type: import("@prisma/client").$Enums.EquipmentType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        notes: string | null;
        createdBy: string;
        purchaseDate: Date;
        unitId: string | null;
        assetId: string | null;
        currentStock: number;
        costPerUnit: number;
        lowStockThreshold: number;
    } & {
        unit: import("@prisma/client").Unit | null;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
    }>;
    update(farmId: string, userId: string, id: string, dto: UpdateEquipmentDto): Promise<{
        type: import("@prisma/client").$Enums.EquipmentType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        notes: string | null;
        createdBy: string;
        purchaseDate: Date;
        unitId: string | null;
        assetId: string | null;
        currentStock: number;
        costPerUnit: number;
        lowStockThreshold: number;
    } & {
        unit: import("@prisma/client").Unit | null;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
    }>;
    archive(farmId: string, userId: string, id: string): Promise<{
        type: import("@prisma/client").$Enums.EquipmentType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        notes: string | null;
        createdBy: string;
        purchaseDate: Date;
        unitId: string | null;
        assetId: string | null;
        currentStock: number;
        costPerUnit: number;
        lowStockThreshold: number;
    } & {
        unit: import("@prisma/client").Unit | null;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
    }>;
    restore(farmId: string, userId: string, id: string): Promise<{
        type: import("@prisma/client").$Enums.EquipmentType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        notes: string | null;
        createdBy: string;
        purchaseDate: Date;
        unitId: string | null;
        assetId: string | null;
        currentStock: number;
        costPerUnit: number;
        lowStockThreshold: number;
    } & {
        unit: import("@prisma/client").Unit | null;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
    }>;
    remove(farmId: string, userId: string, id: string): Promise<{
        type: import("@prisma/client").$Enums.EquipmentType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        notes: string | null;
        createdBy: string;
        purchaseDate: Date;
        unitId: string | null;
        assetId: string | null;
        currentStock: number;
        costPerUnit: number;
        lowStockThreshold: number;
    } & {
        unit: import("@prisma/client").Unit | null;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
    }>;
}
