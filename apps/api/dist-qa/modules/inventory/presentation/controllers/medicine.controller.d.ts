import { MedicineService } from '../../application/services/medicine.service';
import { AdjustStockDto } from '../dto/adjust-stock.dto';
import { BulkDeleteMedicineDto } from '../dto/bulk-delete-medicine.dto';
import { CreateMedicineBatchDto } from '../dto/create-medicine-batch.dto';
import { CreateMedicineDto } from '../dto/create-medicine.dto';
import { ListMedicineQueryDto } from '../dto/list-medicine-query.dto';
import { MedicineByBatchCodeQueryDto } from '../dto/medicine-by-batch-code-query.dto';
import { UpdateMedicineDto } from '../dto/update-medicine.dto';
export declare class MedicineController {
    private readonly medicineService;
    constructor(medicineService: MedicineService);
    create(farmId: string, userId: string, dto: CreateMedicineDto): Promise<{
        type: import("@prisma/client").$Enums.MedicineType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        expiryDate: Date;
        notes: string | null;
        createdBy: string;
        category: import("@prisma/client").$Enums.MedicineCategory;
        purchaseDate: Date;
        unitId: string;
        batchId: string | null;
        currentStock: number;
        costPerUnit: number;
        imageUrl: string | null;
        manufacturer: string | null;
        lowStockThreshold: number;
        milkWithdrawalDays: number;
        meatWithdrawalDays: number;
        photoAssetId: string | null;
    } & {
        unit: import("@prisma/client").Unit;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
        expiryStatus: import("../../domain/medicine-status").ExpiryStatus;
    }>;
    bulkDelete(farmId: string, userId: string, dto: BulkDeleteMedicineDto): Promise<{
        deleted: number;
    }>;
    findAll(farmId: string, query: ListMedicineQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        type: import("@prisma/client").$Enums.MedicineType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        expiryDate: Date;
        notes: string | null;
        createdBy: string;
        category: import("@prisma/client").$Enums.MedicineCategory;
        purchaseDate: Date;
        unitId: string;
        batchId: string | null;
        currentStock: number;
        costPerUnit: number;
        imageUrl: string | null;
        manufacturer: string | null;
        lowStockThreshold: number;
        milkWithdrawalDays: number;
        meatWithdrawalDays: number;
        photoAssetId: string | null;
    } & {
        unit: import("@prisma/client").Unit;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
        expiryStatus: import("../../domain/medicine-status").ExpiryStatus;
    }>>;
    findByBatchCode(farmId: string, query: MedicineByBatchCodeQueryDto): Promise<{
        batchId: string;
        batchCode: string | null;
        medicineId: string;
        medicineName: string;
        currentStock: number;
        costPerUnit: number;
        purchaseDate: Date;
        expiryDate: Date;
        unit: string;
    }[]>;
    findOne(farmId: string, id: string): Promise<{
        type: import("@prisma/client").$Enums.MedicineType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        expiryDate: Date;
        notes: string | null;
        createdBy: string;
        category: import("@prisma/client").$Enums.MedicineCategory;
        purchaseDate: Date;
        unitId: string;
        batchId: string | null;
        currentStock: number;
        costPerUnit: number;
        imageUrl: string | null;
        manufacturer: string | null;
        lowStockThreshold: number;
        milkWithdrawalDays: number;
        meatWithdrawalDays: number;
        photoAssetId: string | null;
    } & {
        unit: import("@prisma/client").Unit;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
        expiryStatus: import("../../domain/medicine-status").ExpiryStatus;
    }>;
    update(farmId: string, userId: string, id: string, dto: UpdateMedicineDto): Promise<{
        type: import("@prisma/client").$Enums.MedicineType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        expiryDate: Date;
        notes: string | null;
        createdBy: string;
        category: import("@prisma/client").$Enums.MedicineCategory;
        purchaseDate: Date;
        unitId: string;
        batchId: string | null;
        currentStock: number;
        costPerUnit: number;
        imageUrl: string | null;
        manufacturer: string | null;
        lowStockThreshold: number;
        milkWithdrawalDays: number;
        meatWithdrawalDays: number;
        photoAssetId: string | null;
    } & {
        unit: import("@prisma/client").Unit;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
        expiryStatus: import("../../domain/medicine-status").ExpiryStatus;
    }>;
    createBatch(farmId: string, userId: string, id: string, dto: CreateMedicineBatchDto): Promise<{
        type: import("@prisma/client").$Enums.MedicineType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        expiryDate: Date;
        notes: string | null;
        createdBy: string;
        category: import("@prisma/client").$Enums.MedicineCategory;
        purchaseDate: Date;
        unitId: string;
        batchId: string | null;
        currentStock: number;
        costPerUnit: number;
        imageUrl: string | null;
        manufacturer: string | null;
        lowStockThreshold: number;
        milkWithdrawalDays: number;
        meatWithdrawalDays: number;
        photoAssetId: string | null;
    } & {
        unit: import("@prisma/client").Unit;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
        expiryStatus: import("../../domain/medicine-status").ExpiryStatus;
    } & {
        batchId: string;
    }>;
    adjustStock(farmId: string, userId: string, id: string, dto: AdjustStockDto): Promise<{
        type: import("@prisma/client").$Enums.MedicineType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        expiryDate: Date;
        notes: string | null;
        createdBy: string;
        category: import("@prisma/client").$Enums.MedicineCategory;
        purchaseDate: Date;
        unitId: string;
        batchId: string | null;
        currentStock: number;
        costPerUnit: number;
        imageUrl: string | null;
        manufacturer: string | null;
        lowStockThreshold: number;
        milkWithdrawalDays: number;
        meatWithdrawalDays: number;
        photoAssetId: string | null;
    } & {
        unit: import("@prisma/client").Unit;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
        expiryStatus: import("../../domain/medicine-status").ExpiryStatus;
    }>;
    getPhoto(farmId: string, id: string): Promise<import("../../../media/application/services/media.service").MediaUrls | null>;
    setPhoto(farmId: string, userId: string, id: string, file: Express.Multer.File): Promise<import("../../../media/application/services/media.service").MediaUrls>;
    removePhoto(farmId: string, userId: string, id: string): Promise<{
        removed: boolean;
    }>;
    archive(farmId: string, userId: string, id: string): Promise<{
        type: import("@prisma/client").$Enums.MedicineType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        expiryDate: Date;
        notes: string | null;
        createdBy: string;
        category: import("@prisma/client").$Enums.MedicineCategory;
        purchaseDate: Date;
        unitId: string;
        batchId: string | null;
        currentStock: number;
        costPerUnit: number;
        imageUrl: string | null;
        manufacturer: string | null;
        lowStockThreshold: number;
        milkWithdrawalDays: number;
        meatWithdrawalDays: number;
        photoAssetId: string | null;
    } & {
        unit: import("@prisma/client").Unit;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
        expiryStatus: import("../../domain/medicine-status").ExpiryStatus;
    }>;
    restore(farmId: string, userId: string, id: string): Promise<{
        type: import("@prisma/client").$Enums.MedicineType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        expiryDate: Date;
        notes: string | null;
        createdBy: string;
        category: import("@prisma/client").$Enums.MedicineCategory;
        purchaseDate: Date;
        unitId: string;
        batchId: string | null;
        currentStock: number;
        costPerUnit: number;
        imageUrl: string | null;
        manufacturer: string | null;
        lowStockThreshold: number;
        milkWithdrawalDays: number;
        meatWithdrawalDays: number;
        photoAssetId: string | null;
    } & {
        unit: import("@prisma/client").Unit;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
        expiryStatus: import("../../domain/medicine-status").ExpiryStatus;
    }>;
    remove(farmId: string, userId: string, id: string): Promise<{
        type: import("@prisma/client").$Enums.MedicineType;
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        expiryDate: Date;
        notes: string | null;
        createdBy: string;
        category: import("@prisma/client").$Enums.MedicineCategory;
        purchaseDate: Date;
        unitId: string;
        batchId: string | null;
        currentStock: number;
        costPerUnit: number;
        imageUrl: string | null;
        manufacturer: string | null;
        lowStockThreshold: number;
        milkWithdrawalDays: number;
        meatWithdrawalDays: number;
        photoAssetId: string | null;
    } & {
        unit: import("@prisma/client").Unit;
    } & {
        stockStatus: import("../../domain/medicine-status").StockStatus;
        expiryStatus: import("../../domain/medicine-status").ExpiryStatus;
    }>;
}
