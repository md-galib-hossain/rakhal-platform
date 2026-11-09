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
var PlatformAdminGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformAdminGuard = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const logger_context_1 = require("src/core/logger/logger/logger.context");
const admin_token_service_1 = require("../../application/services/admin-token.service");
const admin_session_service_1 = require("../../application/services/admin-session.service");
let PlatformAdminGuard = PlatformAdminGuard_1 = class PlatformAdminGuard {
    tokens;
    prisma;
    sessions;
    requestContext;
    log;
    constructor(tokens, prisma, sessions, requestContext, logger) {
        this.tokens = tokens;
        this.prisma = prisma;
        this.sessions = sessions;
        this.requestContext = requestContext;
        this.log = logger.setContext(PlatformAdminGuard_1.name);
    }
    async canActivate(context) {
        const request = context
            .switchToHttp()
            .getRequest();
        const header = request.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('Admin authentication required');
        }
        const token = header.slice('Bearer '.length);
        let payload;
        try {
            payload = await this.tokens.verify(token);
        }
        catch {
            throw new common_1.UnauthorizedException('Admin authentication required');
        }
        if (payload.type !== 'platform_admin' || !payload.sid) {
            throw new common_1.UnauthorizedException('Admin authentication required');
        }
        const admin = await this.prisma.platformAdmin.findUnique({
            where: { id: payload.sub },
        });
        if (!admin || !admin.isActive) {
            this.log.warn('Rejected admin request for missing/inactive admin', {
                adminId: payload.sub,
            });
            throw new common_1.UnauthorizedException('Admin authentication required');
        }
        if (!(await this.sessions.isActive(payload.sid, admin.id))) {
            this.log.warn('Rejected admin request for revoked/expired session', {
                adminId: admin.id,
                sessionId: payload.sid,
            });
            throw new common_1.UnauthorizedException('Admin authentication required');
        }
        request.admin = {
            id: admin.id,
            email: admin.email,
            role: admin.role,
            sessionId: payload.sid,
            mustChangePassword: admin.mustChangePassword,
        };
        this.requestContext.set('sessionId', payload.sid);
        this.requestContext.set('userId', admin.id);
        this.requestContext.set('ipAddress', request.ip);
        this.requestContext.set('userAgent', request.headers['user-agent']);
        return true;
    }
};
exports.PlatformAdminGuard = PlatformAdminGuard;
exports.PlatformAdminGuard = PlatformAdminGuard = PlatformAdminGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [admin_token_service_1.AdminTokenService,
        prisma_service_1.PrismaService,
        admin_session_service_1.AdminSessionService,
        logger_context_1.LoggerContext,
        logger_service_1.LoggerService])
], PlatformAdminGuard);
//# sourceMappingURL=platform-admin.guard.js.map