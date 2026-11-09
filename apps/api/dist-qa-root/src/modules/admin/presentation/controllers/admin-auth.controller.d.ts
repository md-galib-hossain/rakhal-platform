import type { Request } from 'express';
import { AdminAuthService } from '../../application/services/admin-auth.service';
import { AdminSessionService } from '../../application/services/admin-session.service';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { AdminRefreshDto } from '../dto/admin-refresh.dto';
import { ChangePasswordDto } from '../dto/admin-lifecycle.dto';
import { AdminEnableTwoFactorDto } from '../dto/admin-enable-2fa.dto';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
export declare class AdminAuthController {
    private readonly adminAuth;
    private readonly sessions;
    constructor(adminAuth: AdminAuthService, sessions: AdminSessionService);
    login(dto: AdminLoginDto, req: Request): Promise<{
        twoFactorSetupRequired: true;
        setupToken: string;
    } | {
        twoFactorSetupRequired: false;
        accessToken: string;
        refreshToken: string;
        sessionId: string;
        admin: {
            id: string;
            email: string;
            role: string;
        };
    }>;
    refresh(dto: AdminRefreshDto, req: Request): Promise<{
        accessToken: string;
        refreshToken: string;
        sessionId: string;
    }>;
    logout(admin: CurrentAdminContext, req: Request): Promise<{
        loggedOut: boolean;
    }>;
    changePassword(admin: CurrentAdminContext, dto: ChangePasswordDto): Promise<{
        changed: true;
    }>;
    logoutOthers(admin: CurrentAdminContext, req: Request): Promise<{
        revoked: number;
    }>;
    me(admin: CurrentAdminContext): {
        id: string;
        email: string;
        role: import("@prisma/client").$Enums.PlatformAdminRole;
        mustChangePassword: boolean;
        permissions: string[];
    };
    listSessions(admin: CurrentAdminContext): Promise<{
        current: boolean;
        id: string;
        createdAt: Date;
        expiresAt: Date;
        ipAddress: string | null;
        userAgent: string | null;
        lastUsedAt: Date | null;
    }[]>;
    revokeSession(admin: CurrentAdminContext, id: string, req: Request): Promise<{
        revoked: boolean;
    }>;
    setupTwoFactor(admin: CurrentAdminContext): Promise<{
        secret: string;
        otpauthUrl: string;
    }>;
    enableTwoFactor(admin: CurrentAdminContext, dto: AdminEnableTwoFactorDto, req: Request): Promise<{
        enabled: true;
    }>;
}
