import type { ConfigType } from '@nestjs/config';
import type { Response } from 'express';
import { authConfig } from 'src/core/config/env';
import { AuthService } from '../../application/services/auth.service';
import { CsrfService } from '../../application/services/csrf.service';
import type { AuthenticatedHttpRequest } from '../../domain/authenticated-http-request.type';
import { LoginDto } from '../dto/login.dto';
import { LogoutDto } from '../dto/logout.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UpdateLanguageDto } from '../dto/update-language.dto';
export declare class AuthController {
    private readonly authService;
    private readonly csrfService;
    private readonly config;
    constructor(authService: AuthService, csrfService: CsrfService, config: ConfigType<typeof authConfig>);
    register(dto: RegisterDto): Promise<{
        user: import("../../domain/registered-user.type").RegisteredUser;
    }>;
    login(dto: LoginDto, request: AuthenticatedHttpRequest, response: Response): Promise<{
        accessToken: string;
        sessionId: string;
        user: import("../../domain/registered-user.type").RegisteredUser;
        farmId: string;
        needsFarm: boolean;
        farms: import("../../domain/login-result.type").LoginFarmSummary[] | undefined;
    }>;
    verifyEmail(dto: VerifyEmailDto): Promise<{
        success: boolean;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        success: true;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        success: true;
    }>;
    changePassword(dto: ChangePasswordDto, request: AuthenticatedHttpRequest): Promise<{
        success: true;
    }>;
    csrf(request: AuthenticatedHttpRequest, response: Response): {
        csrfToken: string;
    };
    refresh(dto: RefreshTokenDto, request: AuthenticatedHttpRequest, response: Response): Promise<{
        accessToken: string;
        sessionId: string;
        user: import("../../domain/registered-user.type").RegisteredUser;
        farmId: string;
    }>;
    logout(dto: LogoutDto, request: AuthenticatedHttpRequest, response: Response): Promise<{
        success: boolean;
    }>;
    logoutAll(request: AuthenticatedHttpRequest, response: Response): Promise<{
        revokedSessions: number;
        revokedRefreshTokens: number;
        success: boolean;
    }>;
    sessions(request: AuthenticatedHttpRequest): Promise<{
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
    revokeSession(sessionId: string, request: AuthenticatedHttpRequest): Promise<{
        sessionId: string;
        revokedRefreshTokens: number;
        success: boolean;
    }>;
    me(request: AuthenticatedHttpRequest): Promise<{
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
    updateLanguage(dto: UpdateLanguageDto, request: AuthenticatedHttpRequest): import("@prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        preferredLanguage: import("@prisma/client").$Enums.Language;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    private getRefreshTokenFromRequest;
    private getAuthContext;
}
