import { AuditAction, Language as PrismaLanguage, User } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { EmailVerificationTokenPort } from 'src/modules/auth/application/ports/email-verification-token.port';
export declare class RefreshTokenAlreadyRotatedError extends Error {
    constructor();
}
export declare class AuthRepository implements EmailVerificationTokenPort {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findUserByEmail(email: string): Promise<User | null>;
    findUserById(userId: string): Promise<User | null>;
    listActiveFarmMemberships(userId: string): Promise<{
        id: string;
        name: string;
        slug: string;
        role: string;
    }[]>;
    isActiveFarmMember(userId: string, farmId: string): Promise<boolean>;
    findSafeUserById(userId: string): import("@prisma/client").Prisma.Prisma__UserClient<{
        email: string;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        permissionsVersion: number;
        isEmailVerified: boolean;
        emailVerifiedAt: Date | null;
        phoneVerifiedAt: Date | null;
        isBlocked: boolean;
        failedLoginAttempts: number;
        lastFailedLoginAt: Date | null;
        lockedUntil: Date | null;
        lastLoginAt: Date | null;
        lastPasswordChangedAt: Date | null;
        preferredLanguage: import("@prisma/client").$Enums.Language;
        deletedAt: Date | null;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    createEmailVerificationToken(data: {
        userId: string;
        token: string;
        expiresAt: Date;
    }): import("@prisma/client").Prisma.Prisma__AuthTokenClient<{
        type: import("@prisma/client").$Enums.TokenType;
        userId: string;
        id: string;
        createdAt: Date;
        tokenHash: string;
        expiresAt: Date;
        isUsed: boolean;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    createResetToken(data: {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
    }): import("@prisma/client").Prisma.Prisma__AuthTokenClient<{
        type: import("@prisma/client").$Enums.TokenType;
        userId: string;
        id: string;
        createdAt: Date;
        tokenHash: string;
        expiresAt: Date;
        isUsed: boolean;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findResetToken(tokenHash: string): import("@prisma/client").Prisma.Prisma__AuthTokenClient<({
        user: {
            email: string;
            name: string;
            id: string;
        };
    } & {
        type: import("@prisma/client").$Enums.TokenType;
        userId: string;
        id: string;
        createdAt: Date;
        tokenHash: string;
        expiresAt: Date;
        isUsed: boolean;
    }) | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    markResetTokenUsed(tokenId: string): import("@prisma/client").Prisma.Prisma__AuthTokenClient<{
        type: import("@prisma/client").$Enums.TokenType;
        userId: string;
        id: string;
        createdAt: Date;
        tokenHash: string;
        expiresAt: Date;
        isUsed: boolean;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    updateUserPassword(userId: string, passwordHash: string): import("@prisma/client").Prisma.Prisma__UserClient<{
        email: string;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        permissionsVersion: number;
        passwordHash: string | null;
        isEmailVerified: boolean;
        emailVerifiedAt: Date | null;
        phoneVerifiedAt: Date | null;
        isBlocked: boolean;
        failedLoginAttempts: number;
        lastFailedLoginAt: Date | null;
        lockedUntil: Date | null;
        lastLoginAt: Date | null;
        lastPasswordChangedAt: Date | null;
        preferredLanguage: import("@prisma/client").$Enums.Language;
        deletedAt: Date | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    verifyEmailToken(token: string): Promise<User | null>;
    createUser(data: {
        email: string;
        name: string;
        passwordHash: string;
    }): import("@prisma/client").Prisma.Prisma__UserClient<{
        email: string;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        permissionsVersion: number;
        passwordHash: string | null;
        isEmailVerified: boolean;
        emailVerifiedAt: Date | null;
        phoneVerifiedAt: Date | null;
        isBlocked: boolean;
        failedLoginAttempts: number;
        lastFailedLoginAt: Date | null;
        lockedUntil: Date | null;
        lastLoginAt: Date | null;
        lastPasswordChangedAt: Date | null;
        preferredLanguage: import("@prisma/client").$Enums.Language;
        deletedAt: Date | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    registerUserWithVerification(data: {
        email: string;
        name: string;
        passwordHash: string;
        verificationTokenHash: string;
        verificationExpiresAt: Date;
    }): Promise<{
        email: string;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        permissionsVersion: number;
        passwordHash: string | null;
        isEmailVerified: boolean;
        emailVerifiedAt: Date | null;
        phoneVerifiedAt: Date | null;
        isBlocked: boolean;
        failedLoginAttempts: number;
        lastFailedLoginAt: Date | null;
        lockedUntil: Date | null;
        lastLoginAt: Date | null;
        lastPasswordChangedAt: Date | null;
        preferredLanguage: import("@prisma/client").$Enums.Language;
        deletedAt: Date | null;
    }>;
    recordFailedLoginAttempt(data: {
        userId: string;
        failedLoginAttempts: number;
        lockedUntil?: Date | null;
        ipAddress?: string;
        userAgent?: string;
        deviceName?: string;
        reason: string;
    }): Promise<{
        email: string;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        permissionsVersion: number;
        passwordHash: string | null;
        isEmailVerified: boolean;
        emailVerifiedAt: Date | null;
        phoneVerifiedAt: Date | null;
        isBlocked: boolean;
        failedLoginAttempts: number;
        lastFailedLoginAt: Date | null;
        lockedUntil: Date | null;
        lastLoginAt: Date | null;
        lastPasswordChangedAt: Date | null;
        preferredLanguage: import("@prisma/client").$Enums.Language;
        deletedAt: Date | null;
    }>;
    recordSuspiciousLogin(data: {
        userId: string;
        ipAddress?: string;
        userAgent?: string;
        deviceName?: string;
        reason: string;
    }): import("@prisma/client").Prisma.Prisma__AuditLogClient<{
        farmId: string | null;
        action: import("@prisma/client").$Enums.AuditAction;
        id: string;
        createdAt: Date;
        entityType: string;
        entityId: string | null;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        ipAddress: string | null;
        userAgent: string | null;
        actorUserId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    completeSuccessfulLogin(data: {
        userId: string;
        sessionExpiresAt: Date;
        refreshTokenHash: string;
        tokenFamily: string;
        refreshTokenExpiresAt: Date;
        ipAddress?: string;
        userAgent?: string;
        deviceName?: string;
    }): Promise<{
        user: {
            email: string;
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            permissionsVersion: number;
            passwordHash: string | null;
            isEmailVerified: boolean;
            emailVerifiedAt: Date | null;
            phoneVerifiedAt: Date | null;
            isBlocked: boolean;
            failedLoginAttempts: number;
            lastFailedLoginAt: Date | null;
            lockedUntil: Date | null;
            lastLoginAt: Date | null;
            lastPasswordChangedAt: Date | null;
            preferredLanguage: import("@prisma/client").$Enums.Language;
            deletedAt: Date | null;
        };
        session: {
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
        };
    }>;
    createSession(data: {
        userId: string;
        expiresAt: Date;
        ipAddress?: string;
        userAgent?: string;
        deviceName?: string;
    }): import("@prisma/client").Prisma.Prisma__SessionClient<{
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
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    getUserSessions(userId: string): import("@prisma/client").Prisma.PrismaPromise<{
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
    findSessionById(sessionId: string): import("@prisma/client").Prisma.Prisma__SessionClient<({
        user: {
            email: string;
            name: string;
            id: string;
            permissionsVersion: number;
            isBlocked: boolean;
            preferredLanguage: import("@prisma/client").$Enums.Language;
            deletedAt: Date | null;
        };
    } & {
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
    }) | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    updatePreferredLanguage(userId: string, preferredLanguage: PrismaLanguage): import("@prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        preferredLanguage: import("@prisma/client").$Enums.Language;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    revokeSessionForUser(data: {
        sessionId: string;
        userId: string;
        auditAction: AuditAction;
    }): Promise<{
        sessionId: string;
        revokedRefreshTokens: number;
    } | null>;
    revokeAllSessionsForUser(userId: string): Promise<{
        revokedSessions: number;
        revokedRefreshTokens: number;
    }>;
    createRefreshToken(data: {
        sessionId: string;
        tokenHash: string;
        tokenFamily: string;
        expiresAt: Date;
        parentTokenId?: string;
    }): import("@prisma/client").Prisma.Prisma__RefreshTokenClient<{
        sessionId: string;
        id: string;
        createdAt: Date;
        tokenHash: string;
        expiresAt: Date;
        tokenFamily: string;
        isRevoked: boolean;
        revokedAt: Date | null;
        parentTokenId: string | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findRefreshTokenByHash(tokenHash: string): import("@prisma/client").Prisma.Prisma__RefreshTokenClient<({
        session: {
            user: {
                email: string;
                name: string;
                id: string;
                permissionsVersion: number;
                isBlocked: boolean;
                deletedAt: Date | null;
            };
        } & {
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
        };
    } & {
        sessionId: string;
        id: string;
        createdAt: Date;
        tokenHash: string;
        expiresAt: Date;
        tokenFamily: string;
        isRevoked: boolean;
        revokedAt: Date | null;
        parentTokenId: string | null;
    }) | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    revokeRefreshToken(tokenId: string): import("@prisma/client").Prisma.Prisma__RefreshTokenClient<{
        sessionId: string;
        id: string;
        createdAt: Date;
        tokenHash: string;
        expiresAt: Date;
        tokenFamily: string;
        isRevoked: boolean;
        revokedAt: Date | null;
        parentTokenId: string | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    completeRefreshRotation(data: {
        refreshTokenId: string;
        tokenFamily: string;
        tokenHash: string;
        tokenExpiresAt: Date;
        parentTokenId: string;
        sessionId: string;
        userId: string;
        ipAddress?: string;
        userAgent?: string;
        deviceName?: string;
        farmId: string;
        refreshReason: string;
    }): Promise<{
        nextToken: {
            sessionId: string;
            id: string;
            createdAt: Date;
            tokenHash: string;
            expiresAt: Date;
            tokenFamily: string;
            isRevoked: boolean;
            revokedAt: Date | null;
            parentTokenId: string | null;
        };
        session: {
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
        };
    }>;
    markRefreshReuse(data: {
        refreshTokenId: string;
        tokenFamily: string;
        sessionId: string;
        userId: string;
        ipAddress?: string;
        userAgent?: string;
        deviceName?: string;
        farmId: string;
        reason: string;
    }): Promise<{
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
    }>;
}
