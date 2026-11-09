import type { ConfigType } from '@nestjs/config';
import { AppLanguage } from 'src/common/i18n/language';
import { DomainEventBusService } from 'src/common/events/domain-event-bus.service';
import { authConfig } from 'src/core/config/env';
import { CacheService } from 'src/core/cache/cache.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ChangePasswordInput, LoginInput, LogoutInput, RefreshTokenInput, RegisterInput, ResetPasswordInput, RevokeSessionInput } from '../dto/auth.inputs';
import { LoginContext } from '../../domain/login-context.type';
import { LoginResult } from '../../domain/login-result.type';
import { RegisterResult } from '../../domain/register-result.type';
import { AuthRepository } from '../../infrastructure/persistence/repositories/auth.repository';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { PasswordService } from './password.service';
import { PermissionsVersionCacheService } from './permissions-version-cache.service';
import { RefreshTokenService } from './refresh-token.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
export declare class AuthService {
    private readonly config;
    private readonly authRepository;
    private readonly passwordService;
    private readonly sessionService;
    private readonly refreshTokenService;
    private readonly permissionsVersionCache;
    private readonly permissionService;
    private readonly tokenService;
    private readonly eventBus;
    private readonly logger;
    private readonly cacheService;
    private readonly log;
    private readonly passwordResetTokenTtlMinutes;
    private readonly refreshRotationGraceSeconds;
    constructor(config: ConfigType<typeof authConfig>, authRepository: AuthRepository, passwordService: PasswordService, sessionService: SessionService, refreshTokenService: RefreshTokenService, permissionsVersionCache: PermissionsVersionCacheService, permissionService: PermissionService, tokenService: TokenService, eventBus: DomainEventBusService, logger: LoggerService, cacheService: CacheService);
    register(dto: RegisterInput): Promise<RegisterResult>;
    login(dto: LoginInput): Promise<LoginResult>;
    refresh(dto: RefreshTokenInput, rawRefreshToken?: string): Promise<LoginResult>;
    private rotationCacheKey;
    private replayRotationOrMarkReuse;
    logoutCurrentSession(userId: string, sessionId: string): Promise<{
        success: boolean;
    }>;
    logoutAllSessions(userId: string): Promise<{
        revokedSessions: number;
        revokedRefreshTokens: number;
        success: boolean;
    }>;
    listSessions(userId: string): Promise<{
        userId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        expiresAt: Date;
        status: import("@prisma/client").$Enums.SessionStatus;
        ipAddress: string | null;
        userAgent: string | null;
        deviceName: string | null;
        lastUsedAt: Date | null;
    }[]>;
    revokeSessionForCurrentUser(userId: string, sessionId: string): Promise<{
        sessionId: string;
        revokedRefreshTokens: number;
        success: boolean;
    }>;
    logout(dto: LogoutInput): {
        success: boolean;
    };
    logoutAll(userId: string): Promise<{
        revokedSessions: number;
        revokedRefreshTokens: number;
        success: boolean;
    }>;
    sessions(userId: string): Promise<{
        userId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        expiresAt: Date;
        status: import("@prisma/client").$Enums.SessionStatus;
        ipAddress: string | null;
        userAgent: string | null;
        deviceName: string | null;
        lastUsedAt: Date | null;
    }[]>;
    revokeSession(dto: RevokeSessionInput): {
        success: boolean;
    };
    me(userId: string, farmId: string, permissionsVersion: number): Promise<{
        permissions: string[];
        email?: string | undefined;
        name?: string | undefined;
        id?: string | undefined;
        createdAt?: Date | undefined;
        updatedAt?: Date | undefined;
        permissionsVersion?: number | undefined;
        isEmailVerified?: boolean | undefined;
        emailVerifiedAt?: Date | null | undefined;
        phoneVerifiedAt?: Date | null | undefined;
        isBlocked?: boolean | undefined;
        failedLoginAttempts?: number | undefined;
        lastFailedLoginAt?: Date | null | undefined;
        lockedUntil?: Date | null | undefined;
        lastLoginAt?: Date | null | undefined;
        lastPasswordChangedAt?: Date | null | undefined;
        preferredLanguage?: import("@prisma/client").$Enums.Language | undefined;
        deletedAt?: Date | null | undefined;
    }>;
    private resolvePermissionsSafely;
    updateLanguage(userId: string, preferredLanguage: AppLanguage): import("@prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        preferredLanguage: import("@prisma/client").$Enums.Language;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    verifyEmailToken(token: string): Promise<{
        success: boolean;
    }>;
    forgotPassword(email: string): Promise<{
        success: true;
    }>;
    resetPassword(input: ResetPasswordInput): Promise<{
        success: true;
    }>;
    changePassword(userId: string, input: ChangePasswordInput): Promise<{
        success: true;
    }>;
    loginWithContext(dto: LoginInput, context?: LoginContext): Promise<LoginResult>;
    private handleFailedLogin;
    private buildAccessTokenPayload;
    private isLockActive;
    private parseExpiresInToDate;
    private parseDurationToMs;
    private toRegisteredUser;
    private hashToken;
    private isUniqueConstraintError;
    private revokeAccessAfterPasswordUpdate;
}
