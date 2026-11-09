import { AdminManagementService } from '../../application/services/admin-management.service';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { CreateAdminDto, UpdateAdminDto } from '../dto/admin-lifecycle.dto';
import { ListAdminsQueryDto } from '../dto/list-admins.dto';
export declare class AdminAdminsController {
    private readonly admins;
    constructor(admins: AdminManagementService);
    list(query: ListAdminsQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.PlatformAdminRole;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        lastLoginAt: Date | null;
        isActive: boolean;
        mustChangePassword: boolean;
        totpEnabled: boolean;
        passwordChangedAt: Date | null;
        lastLoginIp: string | null;
    }>>;
    get(id: string): Promise<{
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.PlatformAdminRole;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        lastLoginAt: Date | null;
        isActive: boolean;
        mustChangePassword: boolean;
        totpEnabled: boolean;
        passwordChangedAt: Date | null;
        lastLoginIp: string | null;
    }>;
    create(actor: CurrentAdminContext, dto: CreateAdminDto): Promise<{
        admin: import("../../application/services/admin-management.service").SafeAdmin;
        temporaryPassword: string;
    }>;
    update(actor: CurrentAdminContext, id: string, dto: UpdateAdminDto): Promise<{
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.PlatformAdminRole;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        lastLoginAt: Date | null;
        isActive: boolean;
        mustChangePassword: boolean;
        totpEnabled: boolean;
        passwordChangedAt: Date | null;
        lastLoginIp: string | null;
    }>;
    deactivate(actor: CurrentAdminContext, id: string): Promise<{
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.PlatformAdminRole;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        lastLoginAt: Date | null;
        isActive: boolean;
        mustChangePassword: boolean;
        totpEnabled: boolean;
        passwordChangedAt: Date | null;
        lastLoginIp: string | null;
    }>;
    activate(actor: CurrentAdminContext, id: string): Promise<{
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.PlatformAdminRole;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        lastLoginAt: Date | null;
        isActive: boolean;
        mustChangePassword: boolean;
        totpEnabled: boolean;
        passwordChangedAt: Date | null;
        lastLoginIp: string | null;
    }>;
    resetTwoFactor(actor: CurrentAdminContext, id: string): Promise<{
        email: string;
        name: string;
        role: import("@prisma/client").$Enums.PlatformAdminRole;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        lastLoginAt: Date | null;
        isActive: boolean;
        mustChangePassword: boolean;
        totpEnabled: boolean;
        passwordChangedAt: Date | null;
        lastLoginIp: string | null;
    }>;
    resetPassword(actor: CurrentAdminContext, id: string): Promise<{
        admin: import("../../application/services/admin-management.service").SafeAdmin;
        temporaryPassword: string;
    }>;
}
