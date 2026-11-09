import { ShedService } from '../../application/services/shed.service';
import { CreateShedDto } from '../dto/create-shed.dto';
import { ListShedQueryDto } from '../dto/list-shed-query.dto';
import { UpdateShedDto } from '../dto/update-shed.dto';
export declare class ShedController {
    private readonly shedService;
    constructor(shedService: ShedService);
    create(farmId: string, dto: CreateShedDto): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
        code: string;
        capacity: number | null;
        purpose: import("@prisma/client").$Enums.ShedPurpose;
        responsibleMemberId: string | null;
    }>;
    findAll(farmId: string, query: ListShedQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
        code: string;
        capacity: number | null;
        purpose: import("@prisma/client").$Enums.ShedPurpose;
        responsibleMemberId: string | null;
    }>>;
    findOne(farmId: string, id: string): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
        code: string;
        capacity: number | null;
        purpose: import("@prisma/client").$Enums.ShedPurpose;
        responsibleMemberId: string | null;
    }>;
    update(farmId: string, id: string, dto: UpdateShedDto): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
        code: string;
        capacity: number | null;
        purpose: import("@prisma/client").$Enums.ShedPurpose;
        responsibleMemberId: string | null;
    }>;
    archive(farmId: string, id: string): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
        code: string;
        capacity: number | null;
        purpose: import("@prisma/client").$Enums.ShedPurpose;
        responsibleMemberId: string | null;
    }>;
    restore(farmId: string, id: string): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
        code: string;
        capacity: number | null;
        purpose: import("@prisma/client").$Enums.ShedPurpose;
        responsibleMemberId: string | null;
    }>;
    remove(farmId: string, id: string): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
        code: string;
        capacity: number | null;
        purpose: import("@prisma/client").$Enums.ShedPurpose;
        responsibleMemberId: string | null;
    }>;
}
