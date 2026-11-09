import { Medicine, MedicineCategory, MedicineType, MedicineStockMovementReason, Prisma, Unit } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import { MediaService, MediaUrls } from 'src/modules/media/application/services/media.service';
import { CursorPage } from 'src/common/pagination';
import { ExpiryStatus, StockStatus } from '../../domain/medicine-status';
import { AdjustStockDto } from '../../presentation/dto/adjust-stock.dto';
import { CreateMedicineBatchDto } from '../../presentation/dto/create-medicine-batch.dto';
import { CreateMedicineDto } from '../../presentation/dto/create-medicine.dto';
import { ListMedicineQueryDto } from '../../presentation/dto/list-medicine-query.dto';
import { UpdateMedicineDto } from '../../presentation/dto/update-medicine.dto';
import { InventoryActivityService } from './inventory-activity.service';
type MedicineWithUnit = Medicine & {
    unit: Unit;
};
type PresentedMedicine = MedicineWithUnit & {
    stockStatus: StockStatus;
    expiryStatus: ExpiryStatus;
};
type DecrementResult = {
    medicineId: string;
    batchId: string | null;
    balanceAfter: number;
    costPerUnit: number;
    totalCost: number;
    movementIds: string[];
    batchesUsed: {
        medicineId: string;
        batchId: string | null;
        quantity: number;
        balanceAfter: number;
        costPerUnit: number;
    }[];
};
export declare class MedicineService {
    private readonly prisma;
    private readonly notificationService;
    private readonly media;
    private readonly activity;
    private readonly log;
    constructor(prisma: PrismaService, notificationService: NotificationService, media: MediaService, logger: LoggerService, activity: InventoryActivityService);
    create(farmId: string, userId: string, dto: CreateMedicineDto): Promise<PresentedMedicine>;
    createCatalogRowInTx(farmId: string, userId: string, input: {
        name: string;
        type: MedicineType;
        category: MedicineCategory;
        unitId: string;
        manufacturer?: string;
        lowStockThreshold?: number;
        milkWithdrawalDays?: number;
        meatWithdrawalDays?: number;
        notes?: string;
        purchaseDate: Date;
        expiryDate: Date;
        costPerUnit: number;
    }, tx: Prisma.TransactionClient): Promise<{
        id: string;
    }>;
    createBatch(farmId: string, userId: string, medicineId: string, dto: CreateMedicineBatchDto, tx?: Prisma.TransactionClient): Promise<PresentedMedicine & {
        batchId: string;
    }>;
    findAll(farmId: string, query: ListMedicineQueryDto): Promise<CursorPage<PresentedMedicine>>;
    findOne(farmId: string, id: string): Promise<PresentedMedicine>;
    findByBatchCode(farmId: string, code: string): Promise<{
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
    update(farmId: string, id: string, dto: UpdateMedicineDto, userId?: string): Promise<PresentedMedicine>;
    adjustStock(farmId: string, userId: string, id: string, dto: AdjustStockDto, tx?: Prisma.TransactionClient): Promise<PresentedMedicine>;
    adjustStockManual(farmId: string, userId: string, id: string, dto: AdjustStockDto): Promise<PresentedMedicine>;
    decrementForTreatment(farmId: string, userId: string, opts: {
        medicineId?: string;
        medicineName?: string;
        quantity: number;
        doseUnitId?: string;
        notes?: string;
    }): Promise<DecrementResult>;
    decrementForSale(farmId: string, userId: string, opts: {
        medicineId: string;
        quantity: number;
        saleLineId: string;
        notes?: string;
    }, tx?: Prisma.TransactionClient): Promise<DecrementResult>;
    adjustBatchStock(farmId: string, userId: string, medicineBatchId: string, delta: number, reason: MedicineStockMovementReason, notes: string, tx?: Prisma.TransactionClient): Promise<void>;
    restoreForSaleVoid(farmId: string, userId: string, opts: {
        saleLineId: string;
        fallbackMedicineId: string;
        fallbackQuantity: number;
        notes: string;
    }, tx?: Prisma.TransactionClient): Promise<void>;
    restoreForTreatmentVoid(farmId: string, userId: string, opts: {
        treatmentLogId: string;
        fallbackMedicineId?: string | null;
        fallbackQuantity?: number | null;
        notes: string;
    }, tx?: Prisma.TransactionClient): Promise<{
        restored: boolean;
    }>;
    private decrementFromCatalogBatches;
    private maybeAlertLowStock;
    archive(farmId: string, id: string, userId?: string): Promise<PresentedMedicine>;
    restore(farmId: string, id: string, userId?: string): Promise<PresentedMedicine>;
    remove(farmId: string, id: string, userId?: string): Promise<PresentedMedicine>;
    removeMany(farmId: string, ids: string[], userId?: string): Promise<{
        deleted: number;
    }>;
    setPhoto(farmId: string, userId: string, id: string, file: {
        buffer: Buffer;
        originalname?: string;
        size?: number;
    }): Promise<MediaUrls>;
    getPhoto(farmId: string, id: string): Promise<MediaUrls | null>;
    removePhoto(farmId: string, userId: string, id: string): Promise<{
        removed: boolean;
    }>;
    private getOrThrow;
    private syncMedicineAggregate;
    private loadRepresentativeBatch;
    private ensureBatchExists;
    private statusFilter;
    private presentOne;
    private presentList;
    private assertExpiryAfterPurchase;
    private isUniqueError;
}
export {};
