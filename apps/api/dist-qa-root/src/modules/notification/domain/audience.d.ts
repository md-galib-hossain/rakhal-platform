export type AudienceMode = 'SOURCE' | 'USER' | 'ROLES' | 'USERS';
export declare const DEFAULT_SOURCE_ROLES: readonly ["Owner", "Manager"];
export declare const MAX_RECIPIENTS = 100;
export interface AudienceMember {
    userId: string;
    roles: readonly string[];
    active: boolean;
}
export interface AudienceSpec {
    mode: AudienceMode;
    userIds: readonly string[];
    roles: readonly string[];
    sourceUserIds?: readonly string[];
}
export declare function resolveAudience(spec: AudienceSpec, members: readonly AudienceMember[]): string[];
export type AudienceWriteError = 'AUDIENCE_SOURCE_NOT_ALLOWED' | 'AUDIENCE_USER_REQUIRED' | 'AUDIENCE_USERS_REQUIRED' | 'AUDIENCE_ROLES_REQUIRED' | 'AUDIENCE_TOO_MANY' | 'AUDIENCE_FORBIDDEN';
export declare function validateManualAudience(spec: Pick<AudienceSpec, 'mode' | 'userIds' | 'roles'>, actorUserId: string, canManage: boolean): AudienceWriteError | null;
