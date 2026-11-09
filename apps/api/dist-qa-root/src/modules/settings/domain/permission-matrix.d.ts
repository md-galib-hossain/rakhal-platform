import { PermissionGroup } from '@prisma/client';
export interface ResourcePermissions {
    group: PermissionGroup;
    resource: string;
    actions: string[];
}
export declare function buildCatalogue(): ResourcePermissions[];
export declare function concreteKeys(): string[];
export declare function allGrantableKeys(): Set<string>;
export declare function expandGrants(grantedKeys: string[]): Set<string>;
export declare function toMatrix(grantedKeys: string[]): Record<string, Record<string, boolean>>;
export declare function invalidKeys(keys: string[]): string[];
