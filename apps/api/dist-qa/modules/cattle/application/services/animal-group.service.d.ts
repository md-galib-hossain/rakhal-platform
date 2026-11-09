import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CreateAnimalGroupDto } from '../../presentation/dto/create-animal-group.dto';
import { ListAnimalGroupQueryDto } from '../../presentation/dto/list-animal-group-query.dto';
import { UpdateAnimalGroupDto } from '../../presentation/dto/update-animal-group.dto';
export declare class AnimalGroupService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    create(farmId: string, userId: string, dto: CreateAnimalGroupDto): Promise<{
        id: string;
        name: string;
        description: string | null;
        memberCount: number;
        deletedAt: Date | null;
        createdAt: Date;
    }>;
    findAll(farmId: string, query: ListAnimalGroupQueryDto): Promise<{
        items: {
            id: string;
            name: string;
            description: string | null;
            memberCount: number;
            deletedAt: Date | null;
            createdAt: Date;
        }[];
        meta: import("src/common/pagination").CursorPageMeta;
    }>;
    findOne(farmId: string, id: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        memberCount: number;
        deletedAt: Date | null;
        createdAt: Date;
    }>;
    update(farmId: string, id: string, dto: UpdateAnimalGroupDto): Promise<{
        id: string;
        name: string;
        description: string | null;
        memberCount: number;
        deletedAt: Date | null;
        createdAt: Date;
    }>;
    remove(farmId: string, id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    addMembers(farmId: string, userId: string, id: string, cattleIds: string[]): Promise<{
        added: number;
        id: string;
        name: string;
        description: string | null;
        memberCount: number;
        deletedAt: Date | null;
        createdAt: Date;
    }>;
    removeMembers(farmId: string, id: string, cattleIds: string[]): Promise<{
        removed: number;
        id: string;
        name: string;
        description: string | null;
        memberCount: number;
        deletedAt: Date | null;
        createdAt: Date;
    }>;
    private getOrThrow;
    private assertCattleInFarm;
    private toView;
    private isUniqueError;
}
