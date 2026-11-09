import { Equipment, EquipmentType, Prisma, Unit } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage } from 'src/common/pagination';
import { StockStatus } from '../../domain/medicine-status';
import { CreateEquipmentDto } from '../../presentation/dto/create-equipment.dto';
import { ListEquipmentQueryDto } from '../../presentation/dto/list-equipment-query.dto';
import { UpdateEquipmentDto } from '../../presentation/dto/update-equipment.dto';
import { AdjustEquipmentStockDto } from '../../presentation/dto/adjust-equipment-stock.dto';
import { InventoryActivityService } from './inventory-activity.service';
type EquipmentWithUnit = Equipment & {
    unit: Unit | null;
};
type PresentedEquipment = EquipmentWithUnit & {
    stockStatus: StockStatus;
};
export declare class EquipmentService {
    private readonly prisma;
    private readonly activity;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService, activity: InventoryActivityService);
    create(farmId: string, userId: string, dto: CreateEquipmentDto): Promise<PresentedEquipment>;
    createCatalogRowInTx(farmId: string, userId: string, input: {
        name: string;
        assetId?: string;
        type?: EquipmentType;
        unitId?: string;
        lowStockThreshold?: number;
        notes?: string;
        purchaseDate: Date;
        costPerUnit: number;
    }, tx: Prisma.TransactionClient): Promise<{
        id: string;
    }>;
    findAll(farmId: string, query: ListEquipmentQueryDto): Promise<CursorPage<PresentedEquipment>>;
    findOne(farmId: string, id: string): Promise<PresentedEquipment>;
    update(farmId: string, id: string, dto: UpdateEquipmentDto, userId?: string): Promise<PresentedEquipment>;
    archive(farmId: string, id: string, userId?: string): Promise<PresentedEquipment>;
    restore(farmId: string, id: string, userId?: string): Promise<PresentedEquipment>;
    remove(farmId: string, id: string, userId?: string): Promise<PresentedEquipment>;
    adjustStock(farmId: string, userId: string, id: string, dto: AdjustEquipmentStockDto, tx?: Prisma.TransactionClient): Promise<PresentedEquipment>;
    removeMany(farmId: string, ids: string[], userId?: string): Promise<{
        deleted: number;
    }>;
    private getOrThrow;
    private present;
    private isUniqueError;
}
export {};
