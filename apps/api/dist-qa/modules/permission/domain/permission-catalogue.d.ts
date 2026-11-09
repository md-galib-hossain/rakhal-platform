import { PermissionGroup } from '@prisma/client';
export declare const SYSTEM_ROLES: {
    readonly OWNER: "Owner";
    readonly MANAGER: "Manager";
    readonly WORKER: "Worker";
};
export type SystemRoleName = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];
export interface PermissionDef {
    key: string;
    group: PermissionGroup;
    description: string;
}
export declare const PERMISSIONS: PermissionDef[];
export declare const ROLE_PERMISSIONS: Record<SystemRoleName, string[]>;
