import { AnimalHoldService } from '../../application/services/animal-hold.service';
import { CreateAnimalHoldDto } from '../dto/create-animal-hold.dto';
import { ListAnimalHoldQueryDto } from '../dto/list-animal-hold-query.dto';
import { ReleaseAnimalHoldDto } from '../dto/release-animal-hold.dto';
export declare class AnimalHoldController {
    private readonly animalHoldService;
    constructor(animalHoldService: AnimalHoldService);
    list(farmId: string, cattleId: string, query: ListAnimalHoldQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        type: import("@prisma/client").$Enums.AnimalHoldType;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        reason: string;
        cattleId: string;
        createdBy: string;
        startedAt: Date;
        endedAt: Date | null;
        releasedBy: string | null;
    }>>;
    create(farmId: string, userId: string, cattleId: string, dto: CreateAnimalHoldDto): Promise<{
        type: import("@prisma/client").$Enums.AnimalHoldType;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        reason: string;
        cattleId: string;
        createdBy: string;
        startedAt: Date;
        endedAt: Date | null;
        releasedBy: string | null;
    }>;
    release(farmId: string, userId: string, cattleId: string, holdId: string, dto: ReleaseAnimalHoldDto): Promise<{
        type: import("@prisma/client").$Enums.AnimalHoldType;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        reason: string;
        cattleId: string;
        createdBy: string;
        startedAt: Date;
        endedAt: Date | null;
        releasedBy: string | null;
    }>;
}
