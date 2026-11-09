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
var AdminSessionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminSessionService = exports.ADMIN_REFRESH_TTL_MS = void 0;
exports.hashRefreshToken = hashRefreshToken;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const admin_audit_service_1 = require("./admin-audit.service");
exports.ADMIN_REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
function hashRefreshToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
function newRefreshToken() {
    return (0, crypto_1.randomBytes)(48).toString('base64url');
}
let AdminSessionService = AdminSessionService_1 = class AdminSessionService {
    prisma;
    audit;
    log;
    constructor(prisma, audit, logger) {
        this.prisma = prisma;
        this.audit = audit;
        this.log = logger.setContext(AdminSessionService_1.name);
    }
    async create(adminId, client) {
        const refreshToken = newRefreshToken();
        const session = await this.prisma.platformAdminSession.create({
            data: {
                adminId,
                refreshTokenHash: hashRefreshToken(refreshToken),
                expiresAt: new Date(Date.now() + exports.ADMIN_REFRESH_TTL_MS),
                ipAddress: client.ipAddress ?? null,
                userAgent: client.userAgent?.slice(0, 255) ?? null,
            },
        });
        return { session, refreshToken };
    }
    async rotate(presented, client) {
        const hash = hashRefreshToken(presented);
        const current = await this.prisma.platformAdminSession.findUnique({
            where: { refreshTokenHash: hash },
            include: { admin: true },
        });
        if (!current) {
            await this.handlePossibleReuse(hash, client);
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        const { admin, ...session } = current;
        if (session.revokedAt ||
            session.expiresAt <= new Date() ||
            !admin.isActive ||
            !admin.totpEnabled) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        const refreshToken = newRefreshToken();
        const swapped = await this.prisma.platformAdminSession.updateMany({
            where: { id: session.id, refreshTokenHash: hash, revokedAt: null },
            data: {
                refreshTokenHash: hashRefreshToken(refreshToken),
                previousRefreshTokenHash: hash,
                lastUsedAt: new Date(),
                ipAddress: client.ipAddress ?? session.ipAddress,
            },
        });
        if (swapped.count !== 1) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        const updated = await this.prisma.platformAdminSession.findUniqueOrThrow({
            where: { id: session.id },
        });
        return { session: updated, refreshToken, admin };
    }
    async handlePossibleReuse(hash, client) {
        const replayed = await this.prisma.platformAdminSession.findFirst({
            where: { previousRefreshTokenHash: hash, revokedAt: null },
        });
        if (!replayed)
            return;
        await this.prisma.platformAdminSession.update({
            where: { id: replayed.id },
            data: { revokedAt: new Date(), revokedReason: 'REFRESH_TOKEN_REUSE' },
        });
        this.log.warn('Admin refresh-token reuse detected; session revoked', {
            adminId: replayed.adminId,
            sessionId: replayed.id,
        });
        await this.audit.record({
            adminId: replayed.adminId,
            action: 'SESSION_REUSE_DETECTED',
            entityType: 'PlatformAdminSession',
            entityId: replayed.id,
            ipAddress: client.ipAddress,
        });
    }
    async isActive(sessionId, adminId) {
        const session = await this.prisma.platformAdminSession.findUnique({
            where: { id: sessionId },
            select: { adminId: true, revokedAt: true, expiresAt: true },
        });
        return (!!session &&
            session.adminId === adminId &&
            session.revokedAt === null &&
            session.expiresAt > new Date());
    }
    listActive(adminId) {
        return this.prisma.platformAdminSession.findMany({
            where: {
                adminId,
                revokedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                createdAt: true,
                lastUsedAt: true,
                expiresAt: true,
                ipAddress: true,
                userAgent: true,
            },
        });
    }
    async revoke(adminId, sessionId, reason, ipAddress) {
        const result = await this.prisma.platformAdminSession.updateMany({
            where: { id: sessionId, adminId, revokedAt: null },
            data: { revokedAt: new Date(), revokedReason: reason },
        });
        if (result.count === 0)
            return false;
        await this.audit.record({
            adminId,
            action: reason === 'LOGOUT' ? 'LOGOUT' : 'SESSION_REVOKED',
            entityType: 'PlatformAdminSession',
            entityId: sessionId,
            ipAddress,
        });
        return true;
    }
    async revokeAll(adminId, reason, exceptSessionId, ipAddress) {
        const result = await this.prisma.platformAdminSession.updateMany({
            where: {
                adminId,
                revokedAt: null,
                ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
            },
            data: { revokedAt: new Date(), revokedReason: reason },
        });
        if (result.count > 0) {
            await this.audit.record({
                adminId,
                action: 'SESSIONS_REVOKED_ALL',
                entityType: 'PlatformAdmin',
                entityId: adminId,
                metadata: { count: result.count, reason },
                ipAddress,
            });
        }
        return result.count;
    }
};
exports.AdminSessionService = AdminSessionService;
exports.AdminSessionService = AdminSessionService = AdminSessionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        admin_audit_service_1.AdminAuditService,
        logger_service_1.LoggerService])
], AdminSessionService);
//# sourceMappingURL=admin-session.service.js.map