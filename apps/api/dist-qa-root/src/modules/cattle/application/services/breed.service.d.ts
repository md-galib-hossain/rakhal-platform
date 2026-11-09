import { Breed } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage } from 'src/common/pagination';
import { CreateBreedDto } from '../../presentation/dto/create-breed.dto';
import { ListBreedQueryDto } from '../../presentation/dto/list-breed-query.dto';
import { UpdateBreedDto } from '../../presentation/dto/update-breed.dto';
export declare class BreedService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    create(farmId: string, dto: CreateBreedDto): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
    }>;
    findAll(farmId: string, query: ListBreedQueryDto): Promise<CursorPage<Breed>>;
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
    private getOrThrow;
    private isUniqueError;
}
