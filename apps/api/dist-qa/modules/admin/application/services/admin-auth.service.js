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
var AdminAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAuthService = exports.ADMIN_LOCKOUT_WINDOW_MS = exports.ADMIN_LOCKOUT_MAX_FAILURES = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const password_service_1 = require("src/modules/auth/application/services/password.service");
const admin_token_service_1 = require("./admin-token.service");
const admin_audit_service_1 = require("./admin-audit.service");
const admin_totp_service_1 = require("./admin-totp.service");
const admin_password_policy_1 = require("../../domain/admin-password-policy");
const admin_session_service_1 = require("./admin-session.service");
exports.ADMIN_LOCKOUT_MAX_FAILURES = 5;
exports.ADMIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
let AdminAuthService = AdminAuthService_1 = class AdminAuthService {
    prisma;
    passwords;
    tokens;
    audit;
    totp;
    sessions;
    log;
    constructor(prisma, passwords, tokens, audit, totp, sessions, logger) {
        this.prisma = prisma;
        this.passwords = passwords;
        this.tokens = tokens;
        this.audit = audit;
        this.totp = totp;
        this.sessions = sessions;
        this.log = logger.setContext(AdminAuthService_1.name);
    }
    async login(email, password, code, client = {}) {
        const ipAddress = client.ipAddress;
        const admin = await this.prisma.platformAdmin.findUnique({
            where: { email: email.trim().toLowerCase() },
        });
        if (admin && (await this.isLockedOut(admin.id))) {
            await this.recordFailedLogin(admin.id, email, 'LOCKED', client);
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const ok = admin?.isActive === true &&
            (await this.passwords.verifyPassword(admin.passwordHash, password));
        if (!admin || !ok) {
            this.log.warn('Platform-admin login failed', { email });
            await this.recordFailedLogin(admin?.id ?? null, email, !admin
                ? 'UNKNOWN_ADMIN'
                : !admin.isActive
                    ? 'INACTIVE'
                    : 'BAD_PASSWORD', client);
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (!admin.totpEnabled) {
            const setupToken = await this.tokens.sign({ sub: admin.id, type: 'platform_admin_2fa_setup' }, '10m');
            this.log.warn('Platform-admin login pending mandatory 2FA setup', {
                adminId: admin.id,
            });
            return { twoFactorSetupRequired: true, setupToken };
        }
        if (!code || !this.totp.verify(admin.totpSecret, code)) {
            this.log.warn('Platform-admin login failed 2FA', { adminId: admin.id });
            await this.recordFailedLogin(admin.id, email, 'BAD_TOTP', client);
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const { session, refreshToken } = await this.sessions.create(admin.id, client);
        const accessToken = await this.tokens.sign({
            sub: admin.id,
            role: admin.role,
            sid: session.id,
            type: 'platform_admin',
        });
        await this.prisma.platformAdmin.update({
            where: { id: admin.id },
            data: { lastLoginAt: new Date(), lastLoginIp: ipAddress ?? null },
        });
        await this.audit.record({
            adminId: admin.id,
            action: 'LOGIN',
            entityType: 'PlatformAdmin',
            entityId: admin.id,
            sessionId: session.id,
            ipAddress,
            userAgent: client.userAgent,
        });
        return {
            twoFactorSetupRequired: false,
            accessToken,
            refreshToken,
            sessionId: session.id,
            admin: { id: admin.id, email: admin.email, role: admin.role },
        };
    }
    async isLockedOut(adminId) {
        const since = new Date(Date.now() - exports.ADMIN_LOCKOUT_WINDOW_MS);
        const failures = await this.prisma.platformAdminAuditLog.count({
            where: {
                adminId,
                action: 'LOGIN_FAILED',
                createdAt: { gt: since },
                NOT: { metadata: { path: ['reason'], equals: 'LOCKED' } },
            },
        });
        return failures >= exports.ADMIN_LOCKOUT_MAX_FAILURES;
    }
    async recordFailedLogin(adminId, email, reason, client) {
        await this.audit.record({
            adminId,
            action: 'LOGIN_FAILED',
            entityType: 'PlatformAdmin',
            entityId: adminId,
            outcome: 'FAILURE',
            actorEmail: email.trim().toLowerCase(),
            metadata: { reason },
            ipAddress: client.ipAddress,
            userAgent: client.userAgent,
        });
    }
    async changePassword(adminId, currentSessionId, currentPassword, newPassword) {
        const admin = await this.prisma.platformAdmin.findUniqueOrThrow({
            where: { id: adminId },
        });
        if (!(await this.passwords.verifyPassword(admin.passwordHash, currentPassword))) {
            throw new common_1.UnauthorizedException('Current password is incorrect');
        }
        if (currentPassword === newPassword) {
            throw new common_1.BadRequestException('New password must differ from the current one');
        }
        (0, admin_password_policy_1.assertAdminPasswordPolicy)(newPassword);
        await this.prisma.platformAdmin.update({
            where: { id: adminId },
            data: {
                passwordHash: await this.passwords.hashPassword(newPassword),
                mustChangePassword: false,
                passwordChangedAt: new Date(),
            },
        });
        await this.sessions.revokeAll(adminId, 'PASSWORD_CHANGED', currentSessionId);
        await this.audit.record({
            adminId,
            action: 'PASSWORD_CHANGED',
            entityType: 'PlatformAdmin',
            entityId: adminId,
            before: { mustChangePassword: admin.mustChangePassword },
            after: { mustChangePassword: false },
        });
        return { changed: true };
    }
    async refresh(presentedRefreshToken, client) {
        const { session, refreshToken, admin } = await this.sessions.rotate(presentedRefreshToken, client);
        const accessToken = await this.tokens.sign({
            sub: admin.id,
            role: admin.role,
            sid: session.id,
            type: 'platform_admin',
        });
        return { accessToken, refreshToken, sessionId: session.id };
    }
    async beginTwoFactorSetup(adminId) {
        const admin = await this.prisma.platformAdmin.findUniqueOrThrow({
            where: { id: adminId },
        });
        if (admin.totpEnabled) {
            throw new common_1.BadRequestException('2FA is already enabled');
        }
        const secret = this.totp.generateSecret();
        await this.prisma.platformAdmin.update({
            where: { id: adminId },
            data: { totpSecret: secret },
        });
        return {
            secret,
            otpauthUrl: this.totp.buildOtpAuthUrl(admin.email, secret),
        };
    }
    async enableTwoFactor(adminId, code, ipAddress) {
        const admin = await this.prisma.platformAdmin.findUniqueOrThrow({
            where: { id: adminId },
        });
        if (admin.totpEnabled) {
            throw new common_1.BadRequestException('2FA is already enabled');
        }
        if (!admin.totpSecret || !this.totp.verify(admin.totpSecret, code)) {
            throw new common_1.UnauthorizedException('Invalid 2FA code');
        }
        await this.prisma.platformAdmin.update({
            where: { id: adminId },
            data: { totpEnabled: true },
        });
        await this.audit.record({
            adminId,
            action: 'TWO_FACTOR_ENABLED',
            entityType: 'PlatformAdmin',
            entityId: adminId,
            ipAddress,
        });
        return { enabled: true };
    }
};
exports.AdminAuthService = AdminAuthService;
exports.AdminAuthService = AdminAuthService = AdminAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        password_service_1.PasswordService,
        admin_token_service_1.AdminTokenService,
        admin_audit_service_1.AdminAuditService,
        admin_totp_service_1.AdminTotpService,
        admin_session_service_1.AdminSessionService,
        logger_service_1.LoggerService])
], AdminAuthService);
//# sourceMappingURL=admin-auth.service.js.map