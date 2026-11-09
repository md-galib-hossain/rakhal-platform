import { PlatformAdminRole } from '@prisma/client';
export interface AdminAccessTokenPayload {
    sub: string;
    role: PlatformAdminRole;
    sid: string;
    type: 'platform_admin';
}
export interface AdminTwoFactorSetupTokenPayload {
    sub: string;
    type: 'platform_admin_2fa_setup';
}
export type AdminTokenPayload = AdminAccessTokenPayload | AdminTwoFactorSetupTokenPayload;
