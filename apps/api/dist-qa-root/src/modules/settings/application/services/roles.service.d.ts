import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { AuditService } from 'src/modules/audit/application/services/audit.service';
import { CreateRoleDto } from '../../presentation/dto/create-role.dto';
import { UpdateRolePermissionsDto } from '../../presentation/dto/update-role-permissions.dto';
export declare class RolesService {
    private readonly prisma;
    private readonly permissionService;
    private readonly audit;
    private readonly log;
    constructor(prisma: PrismaService, permissionService: PermissionService, audit: AuditService, logger: LoggerService);
    getCatalogue(): {
        permissions: import("../../domain/permission-matrix").ResourcePermissions[];
    };
    listRoles(farmId: string): Promise<{
        roles: {
            id: string;
            name: string;
            description: string | null;
            is_system: boolean;
            editable: boolean;
            member_count: number;
            permission_keys: string[];
            matrix: Record<string, Record<string, boolean>>;
        }[];
        catalogue: import("../../domain/permission-matrix").ResourcePermissions[];
    }>;
    createRole(farmId: string, userId: string, dto: CreateRoleDto): Promise<{
        id: string;
        name: string;
        description: string | null;
        is_system: boolean;
        editable: boolean;
        member_count: number;
        permission_keys: string[];
        matrix: Record<string, Record<string, boolean>>;
    }>;
    updateRolePermissions(farmId: string, userId: string, roleId: string, dto: UpdateRolePermissionsDto): Promise<{
        id: string;
        name: string;
        description: string | null;
        is_system: boolean;
        editable: boolean;
        member_count: number;
        permission_keys: string[];
        matrix: Record<string, Record<string, boolean>>;
    }>;
    deleteRole(farmId: string, userId: string, roleId: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    private detail;
    private getCustomRoleOrThrow;
    private validateKeys;
    private baseRoleKeys;
    private keysToIds;
    private invalidateMembers;
    private isSystemRoleName;
}
