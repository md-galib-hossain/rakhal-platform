import { UnitService } from '../../application/services/unit.service';
import { CreateUnitDto } from '../dto/create-unit.dto';
import { ListUnitQueryDto } from '../dto/list-unit-query.dto';
export declare class UnitController {
    private readonly unitService;
    constructor(unitService: UnitService);
    findAll(farmId: string, query: ListUnitQueryDto): Promise<{
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
    }[]>;
    create(farmId: string, userId: string, dto: CreateUnitDto): Promise<{
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
    }>;
    archive(farmId: string, userId: string, id: string): Promise<{
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
    }>;
}
