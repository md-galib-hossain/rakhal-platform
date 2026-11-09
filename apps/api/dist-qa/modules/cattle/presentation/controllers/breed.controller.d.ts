import { BreedService } from '../../application/services/breed.service';
import { CreateBreedDto } from '../dto/create-breed.dto';
import { ListBreedQueryDto } from '../dto/list-breed-query.dto';
import { UpdateBreedDto } from '../dto/update-breed.dto';
export declare class BreedController {
    private readonly breedService;
    constructor(breedService: BreedService);
    create(farmId: string, dto: CreateBreedDto): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
    }>;
    findAll(farmId: string, query: ListBreedQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
    }>>;
    findOne(farmId: string, id: string): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
    }>;
    update(farmId: string, id: string, dto: UpdateBreedDto): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
    }>;
    archive(farmId: string, id: string): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
    }>;
    restore(farmId: string, id: string): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
    }>;
    remove(farmId: string, id: string): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
    }>;
}
