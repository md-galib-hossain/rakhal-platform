import { MilkTank, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { InventoryActivityService } from './inventory-activity.service';
import { CursorPage } from 'src/common/pagination';
import { AdjustMilkTankVolumeDto, CreateMilkTankDto, ListMilkTankAuditQueryDto, ListMilkTankQueryDto, UpdateMilkTankDto } from '../../presentation/dto/milk-tank.dto';
type PresentedMilkTank = MilkTank & {
    fillPct: number;
    isActive: boolean;
};
export declare class MilkTankService {
    private readonly prisma;
    private readonly activity;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService, activity: InventoryActivityService);
    private recordActivity;
    findAll(farmId: string, query: ListMilkTankQueryDto): Promise<PresentedMilkTank[]>;
    findOne(farmId: string, id: string): Promise<PresentedMilkTank>;
    create(farmId: string, userId: string, dto: CreateMilkTankDto): Promise<PresentedMilkTank>;
    update(farmId: string, id: string, dto: UpdateMilkTankDto, userId?: string): Promise<PresentedMilkTank>;
    adjustVolumeManual(farmId: string, userId: string, id: string, dto: AdjustMilkTankVolumeDto): Promise<PresentedMilkTank>;
    adjustVolume(farmId: string, userId: string, id: string, dto: AdjustMilkTankVolumeDto, tx?: Prisma.TransactionClient, opts?: {
        allowOverCapacity?: boolean;
    }): Promise<PresentedMilkTank>;
    ensureDefaultSellableTank(farmId: string, userId: string, tx: Prisma.TransactionClient): Promise<MilkTank>;
    setPrimary(farmId: string, id: string, userId?: string): Promise<PresentedMilkTank>;
    archive(farmId: string, id: string, userId?: string): Promise<PresentedMilkTank>;
    auditLog(farmId: string, query: ListMilkTankAuditQueryDto): Promise<CursorPage<{
        farmId: string;
        id: string;
        createdAt: Date;
        notes: string | null;
        createdBy: string;
        source: string | null;
        saleLineId: string | null;
        activityType: import("@prisma/client").$Enums.MilkTankActivity;
        balanceAfterL: number;
        milkTankId: string;
        quantityL: number;
    }>>;
    private getOrThrow;
    private assertShedInFarm;
    private present;
}
export {};
