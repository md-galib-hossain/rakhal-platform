import { SemenBatch, SemenTank } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage } from 'src/common/pagination';
import { CreateSemenTankDto, UpdateSemenTankDto } from '../../presentation/dto/semen-tank.dto';
import { CreateSemenBatchDto, ListSemenBatchQueryDto, UpdateSemenBatchDto } from '../../presentation/dto/semen-batch.dto';
import { InventoryActivityService } from './inventory-activity.service';
type PresentedTank = SemenTank & {
    strawInStock: number;
    availableCapacity: number;
};
type PresentedBatch = SemenBatch & {
    lowStraw: boolean;
};
export interface RestoreStrawResult {
    batch: PresentedBatch;
    warning: string | null;
}
export declare class SemenService {
    private readonly prisma;
    private readonly activity;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService, activity: InventoryActivityService);
    listTanks(farmId: string): Promise<PresentedTank[]>;
    createTank(farmId: string, userId: string, dto: CreateSemenTankDto): Promise<PresentedTank>;
    updateTank(farmId: string, id: string, dto: UpdateSemenTankDto, userId?: string): Promise<PresentedTank>;
    archiveTank(farmId: string, id: string, userId?: string): Promise<PresentedTank>;
    listBatches(farmId: string, query: ListSemenBatchQueryDto): Promise<CursorPage<PresentedBatch>>;
    createBatch(farmId: string, userId: string, dto: CreateSemenBatchDto): Promise<PresentedBatch>;
    updateBatch(farmId: string, id: string, dto: UpdateSemenBatchDto, userId?: string): Promise<PresentedBatch>;
    archiveBatch(farmId: string, id: string, userId?: string): Promise<PresentedBatch>;
    decrementStraw(farmId: string, batchId: string, by?: number, actorId?: string | null, sourceEventId?: string | null): Promise<PresentedBatch>;
    restoreStraw(farmId: string, batchId: string, by: number, reason?: string | null, sourceEventId?: string | null, actorId?: string | null): Promise<RestoreStrawResult>;
    private getTankOrThrow;
    private getBatchOrThrow;
    private tankStrawTotal;
    private assertTankCapacity;
    private resolveSemenTypeFields;
    private presentTank;
    private presentBatch;
}
export {};
