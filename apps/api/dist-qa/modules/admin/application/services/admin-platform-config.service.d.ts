import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { CreateFlagDto, SetSettingDto, UpdateFlagDto } from '../../presentation/dto/admin-config.dto';
import { AdminAuditService } from './admin-audit.service';
export declare class AdminPlatformConfigService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AdminAuditService);
    isEnabled(key: string, farmId?: string | null): Promise<boolean>;
    listFlags(): Prisma.PrismaPromise<{
        enabled: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        key: string;
        farmIds: string[];
        updatedById: string | null;
    }[]>;
    createFlag(actorId: string, dto: CreateFlagDto): Promise<{
        enabled: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        key: string;
        farmIds: string[];
        updatedById: string | null;
    }>;
    updateFlag(actorId: string, key: string, dto: UpdateFlagDto): Promise<{
        enabled: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        key: string;
        farmIds: string[];
        updatedById: string | null;
    }>;
    deleteFlag(actorId: string, key: string, reason: string): Promise<{
        key: string;
        deleted: boolean;
    }>;
    listSettings(): Prisma.PrismaPromise<{
        value: Prisma.JsonValue;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        key: string;
        updatedById: string | null;
    }[]>;
    setSetting(actorId: string, key: string, dto: SetSettingDto): Promise<{
        value: Prisma.JsonValue;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        key: string;
        updatedById: string | null;
    }>;
    private getFlag;
}
