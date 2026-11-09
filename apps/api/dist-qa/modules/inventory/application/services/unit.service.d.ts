import { Unit } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CreateUnitDto } from '../../presentation/dto/create-unit.dto';
import { ListUnitQueryDto } from '../../presentation/dto/list-unit-query.dto';
import { InventoryActivityService } from './inventory-activity.service';
export declare function resolveKgPerUnit(unit: Pick<Unit, 'dimension' | 'conversionToBase'>, storedKgPerUnit: number | null): number | null;
export declare class UnitService {
    private readonly prisma;
    private readonly activity;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService, activity: InventoryActivityService);
    findAll(farmId: string, query: ListUnitQueryDto): Promise<Unit[]>;
    create(farmId: string, dto: CreateUnitDto, userId?: string): Promise<Unit>;
    archive(farmId: string, unitId: string, userId?: string): Promise<Unit>;
}
