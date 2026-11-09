import { AuthRepository } from '../../infrastructure/persistence/repositories/auth.repository';
export declare class RefreshTokenService {
    private readonly authRepository;
    constructor(authRepository: AuthRepository);
    hashToken(rawToken: string): string;
    generateToken(): string;
    storeRefreshToken(data: {
        sessionId: string;
        rawToken: string;
        expiresAt: Date;
        tokenFamily?: string;
        parentTokenId?: string;
    }): Promise<{
        sessionId: string;
        id: string;
        createdAt: Date;
        tokenHash: string;
        expiresAt: Date;
        tokenFamily: string;
        isRevoked: boolean;
        revokedAt: Date | null;
        parentTokenId: string | null;
    }>;
    findByRawToken(rawToken: string): import("@prisma/client").Prisma.Prisma__RefreshTokenClient<({
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
    revokeToken(tokenId: string): import("@prisma/client").Prisma.Prisma__RefreshTokenClient<{
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
    completeRotation(data: {
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
    markReuse(data: {
        refreshTokenId: string;
        tokenFamily: string;
        sessionId: string;
        userId: string;
        ipAddress?: string;
        userAgent?: string;
        deviceName?: string;
        farmId: string;
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
