import { RolesService } from '../../application/services/roles.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRolePermissionsDto } from '../dto/update-role-permissions.dto';
export declare class RolesController {
    private readonly rolesService;
    constructor(rolesService: RolesService);
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
    updateRolePermissions(farmId: string, userId: string, id: string, dto: UpdateRolePermissionsDto): Promise<{
        id: string;
        name: string;
        description: string | null;
        is_system: boolean;
        editable: boolean;
        member_count: number;
        permission_keys: string[];
        matrix: Record<string, Record<string, boolean>>;
    }>;
    deleteRole(farmId: string, userId: string, id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
