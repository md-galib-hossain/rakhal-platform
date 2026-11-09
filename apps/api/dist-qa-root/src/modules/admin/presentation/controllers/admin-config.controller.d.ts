import { AdminPlatformConfigService } from '../../application/services/admin-platform-config.service';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { ConfigReasonDto, CreateFlagDto, SetSettingDto, UpdateFlagDto } from '../dto/admin-config.dto';
export declare class AdminConfigController {
    private readonly config;
    constructor(config: AdminPlatformConfigService);
    listFlags(): import("@prisma/client").Prisma.PrismaPromise<{
        enabled: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        key: string;
        farmIds: string[];
        updatedById: string | null;
    }[]>;
    createFlag(admin: CurrentAdminContext, dto: CreateFlagDto): Promise<{
        enabled: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        key: string;
        farmIds: string[];
        updatedById: string | null;
    }>;
    updateFlag(admin: CurrentAdminContext, key: string, dto: UpdateFlagDto): Promise<{
        enabled: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        key: string;
        farmIds: string[];
        updatedById: string | null;
    }>;
    deleteFlag(admin: CurrentAdminContext, key: string, dto: ConfigReasonDto): Promise<{
        key: string;
        deleted: boolean;
    }>;
    listSettings(): import("@prisma/client").Prisma.PrismaPromise<{
        value: import("@prisma/client/runtime/client").JsonValue;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        key: string;
        updatedById: string | null;
    }[]>;
    setSetting(admin: CurrentAdminContext, key: string, dto: SetSettingDto): Promise<{
        value: import("@prisma/client/runtime/client").JsonValue;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        key: string;
        updatedById: string | null;
    }>;
}
