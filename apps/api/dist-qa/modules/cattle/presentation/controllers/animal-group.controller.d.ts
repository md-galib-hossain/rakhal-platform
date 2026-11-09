import { AnimalGroupService } from '../../application/services/animal-group.service';
import { AnimalGroupMembersDto } from '../dto/animal-group-members.dto';
import { CreateAnimalGroupDto } from '../dto/create-animal-group.dto';
import { ListAnimalGroupQueryDto } from '../dto/list-animal-group-query.dto';
import { UpdateAnimalGroupDto } from '../dto/update-animal-group.dto';
export declare class AnimalGroupController {
    private readonly groups;
    constructor(groups: AnimalGroupService);
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
        meta: import("../../../../common/pagination").CursorPageMeta;
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
    addMembers(farmId: string, userId: string, id: string, dto: AnimalGroupMembersDto): Promise<{
        added: number;
        id: string;
        name: string;
        description: string | null;
        memberCount: number;
        deletedAt: Date | null;
        createdAt: Date;
    }>;
    removeMembers(farmId: string, id: string, dto: AnimalGroupMembersDto): Promise<{
        removed: number;
        id: string;
        name: string;
        description: string | null;
        memberCount: number;
        deletedAt: Date | null;
        createdAt: Date;
    }>;
}
