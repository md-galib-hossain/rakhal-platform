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
var SessionGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionGuard = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const auth_repository_1 = require("../../infrastructure/persistence/repositories/auth.repository");
const permissions_version_cache_service_1 = require("../../application/services/permissions-version-cache.service");
let SessionGuard = SessionGuard_1 = class SessionGuard {
    authRepository;
    permissionsVersionCache;
    logger;
    log;
    constructor(authRepository, permissionsVersionCache, logger) {
        this.authRepository = authRepository;
        this.permissionsVersionCache = permissionsVersionCache;
        this.logger = logger;
        this.log = this.logger.setContext(SessionGuard_1.name);
    }
    async canActivate(context) {
        const request = context
            .switchToHttp()
            .getRequest();
        const payload = request.user;
        if (!payload) {
            this.log.warn('Missing access token payload', { reason: 'missing-user' });
            throw new common_1.UnauthorizedException('Unauthorized');
        }
        const session = await this.authRepository.findSessionById(payload.sessionId);
        if (!session || session.userId !== payload.sub) {
            this.log.warn('Rejected request for missing or mismatched session', {
                userId: payload.sub,
                sessionId: payload.sessionId,
            });
            throw new common_1.UnauthorizedException('Session is not active');
        }
        const now = new Date();
        if (session.status !== client_1.SessionStatus.ACTIVE ||
            session.expiresAt.getTime() <= now.getTime()) {
            this.log.warn('Rejected request for inactive session', {
                userId: payload.sub,
                sessionId: payload.sessionId,
                status: session.status,
            });
            throw new common_1.UnauthorizedException('Session is not active');
        }
        if (!session.user || session.user.deletedAt || session.user.isBlocked) {
            this.log.warn('Rejected request for blocked or deleted user', {
                userId: payload.sub,
                sessionId: payload.sessionId,
            });
            throw new common_1.UnauthorizedException('Session is not active');
        }
        const cachedPermissionsVersion = await this.permissionsVersionCache.get(session.userId);
        if (cachedPermissionsVersion === undefined) {
            await this.permissionsVersionCache.set(session.userId, session.user.permissionsVersion);
        }
        else if (cachedPermissionsVersion !== session.user.permissionsVersion) {
            await this.permissionsVersionCache.set(session.userId, session.user.permissionsVersion);
        }
        if (payload.permissionsVersion !== session.user.permissionsVersion) {
            this.log.warn('Rejected request for stale permissions version', {
                userId: payload.sub,
                sessionId: payload.sessionId,
                tokenPermissionsVersion: payload.permissionsVersion,
                currentPermissionsVersion: session.user.permissionsVersion,
            });
            throw new common_1.UnauthorizedException('Session permissions are stale');
        }
        request.auth = {
            user: payload,
            session: {
                id: session.id,
                userId: session.userId,
                status: session.status,
                expiresAt: session.expiresAt,
                lastUsedAt: session.lastUsedAt,
            },
            account: {
                id: session.user.id,
                email: session.user.email,
                name: session.user.name,
                permissionsVersion: session.user.permissionsVersion,
                isBlocked: session.user.isBlocked,
                deletedAt: session.user.deletedAt,
                preferredLanguage: session.user.preferredLanguage.toLowerCase(),
            },
        };
        return true;
    }
};
exports.SessionGuard = SessionGuard;
exports.SessionGuard = SessionGuard = SessionGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_repository_1.AuthRepository,
        permissions_version_cache_service_1.PermissionsVersionCacheService,
        logger_service_1.LoggerService])
], SessionGuard);
//# sourceMappingURL=session.guard.js.map