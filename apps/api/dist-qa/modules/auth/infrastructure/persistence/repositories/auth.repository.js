"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRepository = exports.RefreshTokenAlreadyRotatedError = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
class RefreshTokenAlreadyRotatedError extends Error {
    constructor() {
        super('Refresh token was already rotated by a concurrent request');
        this.name = 'RefreshTokenAlreadyRotatedError';
    }
}
exports.RefreshTokenAlreadyRotatedError = RefreshTokenAlreadyRotatedError;
let AuthRepository = class AuthRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findUserByEmail(email) {
        return this.prisma.user.findUnique({ where: { email } });
    }
    findUserById(userId) {
        return this.prisma.user.findUnique({ where: { id: userId } });
    }
    async listActiveFarmMemberships(userId) {
        const memberships = await this.prisma.farmMember.findMany({
            where: { userId, farm: { deletedAt: null } },
            select: {
                role: { select: { name: true } },
                farm: { select: { id: true, name: true, slug: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
        return memberships.map((m) => ({ ...m.farm, role: m.role.name }));
    }
    async isActiveFarmMember(userId, farmId) {
        const membership = await this.prisma.farmMember.findFirst({
            where: { userId, farmId, farm: { deletedAt: null } },
            select: { id: true },
        });
        return membership !== null;
    }
    findSafeUserById(userId) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            omit: { passwordHash: true },
        });
    }
    createEmailVerificationToken(data) {
        return this.prisma.authToken.create({
            data: {
                userId: data.userId,
                type: client_1.TokenType.EMAIL_VERIFICATION,
                tokenHash: (0, crypto_1.createHash)('sha256').update(data.token).digest('hex'),
                expiresAt: data.expiresAt,
            },
        });
    }
    createResetToken(data) {
        return this.prisma.authToken.create({
            data: {
                userId: data.userId,
                type: client_1.TokenType.PASSWORD_RESET,
                tokenHash: data.tokenHash,
                expiresAt: data.expiresAt,
            },
        });
    }
    findResetToken(tokenHash) {
        const now = new Date();
        return this.prisma.authToken.findFirst({
            where: {
                tokenHash,
                type: client_1.TokenType.PASSWORD_RESET,
                isUsed: false,
                expiresAt: { gt: now },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });
    }
    markResetTokenUsed(tokenId) {
        return this.prisma.authToken.update({
            where: { id: tokenId },
            data: { isUsed: true },
        });
    }
    updateUserPassword(userId, passwordHash) {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash,
                failedLoginAttempts: 0,
                lockedUntil: null,
            },
        });
    }
    async verifyEmailToken(token) {
        const tokenHash = (0, crypto_1.createHash)('sha256').update(token).digest('hex');
        const now = new Date();
        return this.prisma.$transaction(async (prisma) => {
            const authToken = await prisma.authToken.findFirst({
                where: {
                    tokenHash,
                    type: client_1.TokenType.EMAIL_VERIFICATION,
                    isUsed: false,
                    expiresAt: { gt: now },
                },
            });
            if (!authToken) {
                return null;
            }
            await prisma.authToken.update({
                where: { id: authToken.id },
                data: { isUsed: true },
            });
            return prisma.user.update({
                where: { id: authToken.userId },
                data: { isEmailVerified: true },
            });
        });
    }
    createUser(data) {
        return this.prisma.user.create({ data });
    }
    registerUserWithVerification(data) {
        return this.prisma.$transaction(async (prisma) => {
            const user = await prisma.user.create({
                data: {
                    email: data.email,
                    name: data.name,
                    passwordHash: data.passwordHash,
                },
            });
            await prisma.authToken.create({
                data: {
                    userId: user.id,
                    type: client_1.TokenType.EMAIL_VERIFICATION,
                    tokenHash: data.verificationTokenHash,
                    expiresAt: data.verificationExpiresAt,
                },
            });
            await prisma.auditLog.create({
                data: {
                    actorUserId: user.id,
                    action: client_1.AuditAction.REGISTER,
                    entityType: 'User',
                    entityId: user.id,
                    metadata: {
                        emailDomain: data.email.split('@')[1] ?? null,
                    },
                },
            });
            return user;
        });
    }
    recordFailedLoginAttempt(data) {
        return this.prisma.$transaction(async (prisma) => {
            const user = await prisma.user.update({
                where: { id: data.userId },
                data: {
                    failedLoginAttempts: data.failedLoginAttempts,
                    lockedUntil: data.lockedUntil ?? undefined,
                    lastFailedLoginAt: new Date(),
                },
            });
            await prisma.auditLog.create({
                data: {
                    actorUserId: data.userId,
                    action: client_1.AuditAction.SUSPICIOUS_ACTIVITY,
                    entityType: 'User',
                    entityId: data.userId,
                    metadata: {
                        reason: data.reason,
                        failedLoginAttempts: data.failedLoginAttempts,
                    },
                    ipAddress: data.ipAddress,
                    userAgent: data.userAgent,
                },
            });
            return user;
        });
    }
    recordSuspiciousLogin(data) {
        return this.prisma.auditLog.create({
            data: {
                actorUserId: data.userId,
                action: client_1.AuditAction.SUSPICIOUS_ACTIVITY,
                entityType: 'User',
                entityId: data.userId,
                metadata: {
                    reason: data.reason,
                    deviceName: data.deviceName ?? null,
                },
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
            },
        });
    }
    completeSuccessfulLogin(data) {
        return this.prisma.$transaction(async (prisma) => {
            const user = await prisma.user.update({
                where: { id: data.userId },
                data: {
                    failedLoginAttempts: 0,
                    lastFailedLoginAt: null,
                    lockedUntil: null,
                    lastLoginAt: new Date(),
                },
            });
            const session = await prisma.session.create({
                data: {
                    userId: data.userId,
                    status: client_1.SessionStatus.ACTIVE,
                    expiresAt: data.sessionExpiresAt,
                    ipAddress: data.ipAddress,
                    userAgent: data.userAgent,
                    deviceName: data.deviceName,
                },
            });
            await prisma.refreshToken.create({
                data: {
                    sessionId: session.id,
                    tokenHash: data.refreshTokenHash,
                    tokenFamily: data.tokenFamily,
                    expiresAt: data.refreshTokenExpiresAt,
                },
            });
            await prisma.auditLog.create({
                data: {
                    actorUserId: data.userId,
                    action: client_1.AuditAction.LOGIN,
                    entityType: 'Session',
                    entityId: session.id,
                    ipAddress: data.ipAddress,
                    userAgent: data.userAgent,
                    metadata: {
                        deviceName: data.deviceName ?? null,
                    },
                },
            });
            return { user, session };
        });
    }
    createSession(data) {
        return this.prisma.session.create({
            data: {
                ...data,
                status: client_1.SessionStatus.ACTIVE,
            },
        });
    }
    getUserSessions(userId) {
        return this.prisma.session.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
    findSessionById(sessionId) {
        return this.prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        permissionsVersion: true,
                        isBlocked: true,
                        deletedAt: true,
                        preferredLanguage: true,
                    },
                },
            },
        });
    }
    updatePreferredLanguage(userId, preferredLanguage) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { preferredLanguage },
            select: { id: true, preferredLanguage: true },
        });
    }
    revokeSessionForUser(data) {
        return this.prisma.$transaction(async (prisma) => {
            const session = await prisma.session.findFirst({
                where: {
                    id: data.sessionId,
                    userId: data.userId,
                },
                select: {
                    id: true,
                },
            });
            if (!session) {
                return null;
            }
            await prisma.session.update({
                where: { id: data.sessionId },
                data: {
                    status: client_1.SessionStatus.REVOKED,
                },
            });
            const revokedRefreshTokens = await prisma.refreshToken.updateMany({
                where: {
                    sessionId: data.sessionId,
                },
                data: {
                    isRevoked: true,
                    revokedAt: new Date(),
                },
            });
            await prisma.auditLog.create({
                data: {
                    actorUserId: data.userId,
                    action: data.auditAction,
                    entityType: 'Session',
                    entityId: data.sessionId,
                    metadata: {
                        revokedRefreshTokens: revokedRefreshTokens.count,
                    },
                },
            });
            return {
                sessionId: data.sessionId,
                revokedRefreshTokens: revokedRefreshTokens.count,
            };
        });
    }
    revokeAllSessionsForUser(userId) {
        return this.prisma.$transaction(async (prisma) => {
            const activeSessions = await prisma.session.findMany({
                where: {
                    userId,
                    status: client_1.SessionStatus.ACTIVE,
                },
                select: {
                    id: true,
                },
            });
            const sessionIds = activeSessions.map((session) => session.id);
            if (sessionIds.length === 0) {
                return {
                    revokedSessions: 0,
                    revokedRefreshTokens: 0,
                };
            }
            const revokedSessions = await prisma.session.updateMany({
                where: {
                    id: {
                        in: sessionIds,
                    },
                },
                data: {
                    status: client_1.SessionStatus.REVOKED,
                },
            });
            const revokedRefreshTokens = await prisma.refreshToken.updateMany({
                where: {
                    sessionId: {
                        in: sessionIds,
                    },
                },
                data: {
                    isRevoked: true,
                    revokedAt: new Date(),
                },
            });
            await prisma.auditLog.create({
                data: {
                    actorUserId: userId,
                    action: client_1.AuditAction.LOGOUT,
                    entityType: 'User',
                    entityId: userId,
                    metadata: {
                        scope: 'all-sessions',
                        revokedSessions: revokedSessions.count,
                        revokedRefreshTokens: revokedRefreshTokens.count,
                    },
                },
            });
            return {
                revokedSessions: revokedSessions.count,
                revokedRefreshTokens: revokedRefreshTokens.count,
            };
        });
    }
    createRefreshToken(data) {
        return this.prisma.refreshToken.create({
            data: {
                sessionId: data.sessionId,
                tokenHash: data.tokenHash,
                tokenFamily: data.tokenFamily,
                expiresAt: data.expiresAt,
                parentTokenId: data.parentTokenId,
            },
        });
    }
    findRefreshTokenByHash(tokenHash) {
        return this.prisma.refreshToken.findUnique({
            where: { tokenHash },
            include: {
                session: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                                permissionsVersion: true,
                                isBlocked: true,
                                deletedAt: true,
                            },
                        },
                    },
                },
            },
        });
    }
    revokeRefreshToken(tokenId) {
        return this.prisma.refreshToken.update({
            where: { id: tokenId },
            data: {
                isRevoked: true,
                revokedAt: new Date(),
            },
        });
    }
    completeRefreshRotation(data) {
        return this.prisma.$transaction(async (prisma) => {
            const claim = await prisma.refreshToken.updateMany({
                where: { id: data.refreshTokenId, isRevoked: false },
                data: {
                    isRevoked: true,
                    revokedAt: new Date(),
                },
            });
            if (claim.count === 0) {
                throw new RefreshTokenAlreadyRotatedError();
            }
            const previousToken = await prisma.refreshToken.findUniqueOrThrow({
                where: { id: data.refreshTokenId },
            });
            const nextToken = await prisma.refreshToken.create({
                data: {
                    sessionId: data.sessionId,
                    tokenHash: data.tokenHash,
                    tokenFamily: data.tokenFamily,
                    parentTokenId: data.parentTokenId,
                    expiresAt: data.tokenExpiresAt,
                },
            });
            const session = await prisma.session.update({
                where: { id: data.sessionId },
                data: {
                    lastUsedAt: new Date(),
                },
            });
            await prisma.auditLog.create({
                data: {
                    actorUserId: data.userId,
                    action: client_1.AuditAction.LOGIN,
                    entityType: 'Session',
                    entityId: data.sessionId,
                    ipAddress: data.ipAddress,
                    userAgent: data.userAgent,
                    metadata: {
                        event: 'refresh-rotated',
                        deviceName: data.deviceName ?? null,
                        farmId: data.farmId,
                        tokenFamily: data.tokenFamily,
                        parentTokenId: data.parentTokenId,
                        previousTokenId: previousToken.id,
                        nextTokenId: nextToken.id,
                    },
                },
            });
            return { nextToken, session };
        });
    }
    markRefreshReuse(data) {
        return this.prisma.$transaction(async (prisma) => {
            const compromisedSession = await prisma.session.update({
                where: { id: data.sessionId },
                data: {
                    status: client_1.SessionStatus.COMPROMISED,
                },
            });
            await prisma.refreshToken.updateMany({
                where: {
                    tokenFamily: data.tokenFamily,
                },
                data: {
                    isRevoked: true,
                    revokedAt: new Date(),
                },
            });
            await prisma.auditLog.create({
                data: {
                    actorUserId: data.userId,
                    action: client_1.AuditAction.SUSPICIOUS_ACTIVITY,
                    entityType: 'Session',
                    entityId: data.sessionId,
                    ipAddress: data.ipAddress,
                    userAgent: data.userAgent,
                    metadata: {
                        event: 'refresh-token-reuse',
                        reason: data.reason,
                        deviceName: data.deviceName ?? null,
                        farmId: data.farmId,
                        tokenFamily: data.tokenFamily,
                        refreshTokenId: data.refreshTokenId,
                    },
                },
            });
            return compromisedSession;
        });
    }
};
exports.AuthRepository = AuthRepository;
exports.AuthRepository = AuthRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuthRepository);
//# sourceMappingURL=auth.repository.js.map