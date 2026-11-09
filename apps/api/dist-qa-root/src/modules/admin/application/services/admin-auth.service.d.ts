import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PasswordService } from 'src/modules/auth/application/services/password.service';
import { AdminTokenService } from './admin-token.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminTotpService } from './admin-totp.service';
import { AdminClientContext, AdminSessionService } from './admin-session.service';
export declare const ADMIN_LOCKOUT_MAX_FAILURES = 5;
export declare const ADMIN_LOCKOUT_WINDOW_MS: number;
type LoginResult = {
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
};
export declare class AdminAuthService {
    private readonly prisma;
    private readonly passwords;
    private readonly tokens;
    private readonly audit;
    private readonly totp;
    private readonly sessions;
    private readonly log;
    constructor(prisma: PrismaService, passwords: PasswordService, tokens: AdminTokenService, audit: AdminAuditService, totp: AdminTotpService, sessions: AdminSessionService, logger: LoggerService);
    login(email: string, password: string, code: string | undefined, client?: AdminClientContext): Promise<LoginResult>;
    private isLockedOut;
    private recordFailedLogin;
    changePassword(adminId: string, currentSessionId: string | undefined, currentPassword: string, newPassword: string): Promise<{
        changed: true;
    }>;
    refresh(presentedRefreshToken: string, client: AdminClientContext): Promise<{
        accessToken: string;
        refreshToken: string;
        sessionId: string;
    }>;
    beginTwoFactorSetup(adminId: string): Promise<{
        secret: string;
        otpauthUrl: string;
    }>;
    enableTwoFactor(adminId: string, code: string, ipAddress?: string): Promise<{
        enabled: true;
    }>;
}
export {};
