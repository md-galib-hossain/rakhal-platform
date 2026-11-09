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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const domain_event_bus_service_1 = require("src/common/events/domain-event-bus.service");
const env_1 = require("src/core/config/env");
const cache_service_1 = require("src/core/cache/cache.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const user_registered_event_1 = require("src/modules/auth/domain/events/user-registered.event");
const auth_repository_1 = require("../../infrastructure/persistence/repositories/auth.repository");
const permission_service_1 = require("src/modules/permission/application/services/permission.service");
const password_service_1 = require("./password.service");
const permissions_version_cache_service_1 = require("./permissions-version-cache.service");
const refresh_token_service_1 = require("./refresh-token.service");
const session_service_1 = require("./session.service");
const token_service_1 = require("./token.service");
const password_changed_event_1 = require("src/modules/auth/domain/events/password-changed.event");
const password_reset_requested_event_1 = require("src/modules/auth/domain/events/password-reset-requested.event");
const password_reset_successful_event_1 = require("src/modules/auth/domain/events/password-reset-successful.event");
let AuthService = AuthService_1 = class AuthService {
    config;
    authRepository;
    passwordService;
    sessionService;
    refreshTokenService;
    permissionsVersionCache;
    permissionService;
    tokenService;
    eventBus;
    logger;
    cacheService;
    log;
    passwordResetTokenTtlMinutes = 30;
    refreshRotationGraceSeconds = 10;
    constructor(config, authRepository, passwordService, sessionService, refreshTokenService, permissionsVersionCache, permissionService, tokenService, eventBus, logger, cacheService) {
        this.config = config;
        this.authRepository = authRepository;
        this.passwordService = passwordService;
        this.sessionService = sessionService;
        this.refreshTokenService = refreshTokenService;
        this.permissionsVersionCache = permissionsVersionCache;
        this.permissionService = permissionService;
        this.tokenService = tokenService;
        this.eventBus = eventBus;
        this.logger = logger;
        this.cacheService = cacheService;
        this.log = this.logger.setContext(AuthService_1.name);
    }
    async register(dto) {
        const passwordHash = await this.passwordService.hashPassword(dto.password);
        try {
            const user = await this.authRepository.createUser({
                email: dto.email,
                name: dto.name,
                passwordHash,
            });
            this.eventBus.emit(user_registered_event_1.USER_REGISTERED_EVENT, {
                userId: user.id,
                email: user.email,
                name: user.name,
                tenantId: user.id,
                farmId: null,
            });
            this.log.audit('auth.register', {
                userId: user.id,
                tenantId: user.id,
                farmId: null,
                correlationId: null,
                timestamp: new Date().toISOString(),
                emailDomain: dto.email.split('@')[1] ?? null,
            });
            return {
                user: this.toRegisteredUser(user),
            };
        }
        catch (error) {
            if (this.isUniqueConstraintError(error)) {
                throw new common_1.ConflictException('Email already exists');
            }
            throw error;
        }
    }
    async login(dto) {
        return this.loginWithContext(dto);
    }
    async refresh(dto, rawRefreshToken) {
        if (!rawRefreshToken) {
            throw new common_1.UnauthorizedException('Refresh token is required');
        }
        const incomingTokenHash = this.refreshTokenService.hashToken(rawRefreshToken);
        const storedToken = await this.refreshTokenService.findByRawToken(rawRefreshToken);
        if (!storedToken?.session?.user) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        const now = new Date();
        const session = storedToken.session;
        const user = session.user;
        if (dto.farmId && dto.farmId !== 'bootstrap') {
            const isMember = await this.authRepository.isActiveFarmMember(user.id, dto.farmId);
            if (!isMember) {
                throw new common_1.UnauthorizedException('Not a member of this farm');
            }
        }
        if (storedToken.isRevoked ||
            storedToken.expiresAt.getTime() <= now.getTime() ||
            session.status !== client_1.SessionStatus.ACTIVE ||
            session.expiresAt.getTime() <= now.getTime()) {
            return this.replayRotationOrMarkReuse({
                incomingTokenHash,
                storedTokenId: storedToken.id,
                tokenFamily: storedToken.tokenFamily,
                session,
                user,
                farmId: dto.farmId,
            });
        }
        const nextRefreshToken = this.refreshTokenService.generateToken();
        const nextRefreshTokenHash = this.refreshTokenService.hashToken(nextRefreshToken);
        const nextRefreshTokenExpiresAt = new Date(now.getTime() + this.parseDurationToMs(this.config.refreshExpiresIn));
        let rotationResult;
        try {
            rotationResult = await this.refreshTokenService.completeRotation({
                refreshTokenId: storedToken.id,
                tokenFamily: storedToken.tokenFamily,
                tokenHash: nextRefreshTokenHash,
                tokenExpiresAt: nextRefreshTokenExpiresAt,
                parentTokenId: storedToken.id,
                sessionId: session.id,
                userId: user.id,
                farmId: dto.farmId,
                deviceName: session.deviceName ?? undefined,
            });
        }
        catch (error) {
            if (error instanceof auth_repository_1.RefreshTokenAlreadyRotatedError) {
                return this.replayRotationOrMarkReuse({
                    incomingTokenHash,
                    storedTokenId: storedToken.id,
                    tokenFamily: storedToken.tokenFamily,
                    session,
                    user,
                    farmId: dto.farmId,
                    retries: 3,
                });
            }
            throw error;
        }
        const accessToken = await this.tokenService.signAccessToken(this.buildAccessTokenPayload({
            userId: user.id,
            sessionId: rotationResult.session.id,
            farmId: dto.farmId,
            permissionsVersion: user.permissionsVersion,
        }));
        await this.permissionsVersionCache.set(user.id, user.permissionsVersion);
        this.log.audit('auth.refresh', {
            userId: user.id,
            sessionId: rotationResult.session.id,
            tokenFamily: storedToken.tokenFamily,
            farmId: dto.farmId,
        });
        const result = {
            accessToken,
            refreshToken: nextRefreshToken,
            sessionId: rotationResult.session.id,
            user: this.toRegisteredUser(user),
            farmId: dto.farmId,
            needsFarm: dto.farmId === '',
        };
        await this.cacheService.set(this.rotationCacheKey(incomingTokenHash), result, this.refreshRotationGraceSeconds);
        return result;
    }
    rotationCacheKey(tokenHash) {
        return `auth:refresh-rotated:${tokenHash}`;
    }
    async replayRotationOrMarkReuse(params) {
        const { incomingTokenHash, storedTokenId, tokenFamily, session, user, farmId, } = params;
        const retries = params.retries ?? 0;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
            const replay = await this.cacheService.get(this.rotationCacheKey(incomingTokenHash));
            if (replay) {
                return replay;
            }
            if (attempt < retries) {
                await new Promise((resolve) => setTimeout(resolve, 75));
            }
        }
        await this.refreshTokenService.markReuse({
            refreshTokenId: storedTokenId,
            tokenFamily,
            sessionId: session.id,
            userId: user.id,
            ipAddress: undefined,
            userAgent: undefined,
            deviceName: session.deviceName ?? undefined,
            farmId,
        });
        this.log.warn('Refresh token reuse detected', {
            userId: user.id,
            sessionId: session.id,
            tokenFamily,
            farmId,
        });
        throw new common_1.UnauthorizedException('Invalid refresh token');
    }
    async logoutCurrentSession(userId, sessionId) {
        const result = await this.sessionService.revokeSessionForUser(sessionId, userId, client_1.AuditAction.LOGOUT);
        if (!result) {
            throw new common_1.UnauthorizedException('Session not found');
        }
        await this.permissionsVersionCache.invalidate(userId);
        this.log.audit('auth.logout', {
            userId,
            sessionId,
        });
        return {
            success: true,
        };
    }
    async logoutAllSessions(userId) {
        const result = await this.sessionService.revokeAllSessionsForUser(userId);
        await this.permissionsVersionCache.invalidate(userId);
        this.log.audit('auth.logout_all', {
            userId,
            revokedSessions: result.revokedSessions,
            revokedRefreshTokens: result.revokedRefreshTokens,
        });
        return {
            success: true,
            ...result,
        };
    }
    async listSessions(userId) {
        return this.sessionService.listUserSessions(userId);
    }
    async revokeSessionForCurrentUser(userId, sessionId) {
        const result = await this.sessionService.revokeSessionForUser(sessionId, userId, client_1.AuditAction.SESSION_REVOKED);
        if (!result) {
            throw new common_1.UnauthorizedException('Session not found');
        }
        await this.permissionsVersionCache.invalidate(userId);
        this.log.audit('auth.session_revoked', {
            userId,
            sessionId,
            revokedRefreshTokens: result.revokedRefreshTokens,
        });
        return {
            success: true,
            ...result,
        };
    }
    logout(dto) {
        void dto;
        return {
            success: true,
        };
    }
    logoutAll(userId) {
        return this.logoutAllSessions(userId);
    }
    sessions(userId) {
        return this.listSessions(userId);
    }
    revokeSession(dto) {
        void dto;
        return {
            success: true,
        };
    }
    async me(userId, farmId, permissionsVersion) {
        const user = await this.authRepository.findSafeUserById(userId);
        const permissions = await this.resolvePermissionsSafely(userId, farmId, permissionsVersion);
        return { ...user, permissions };
    }
    async resolvePermissionsSafely(userId, farmId, permissionsVersion) {
        try {
            return await this.permissionService.resolvePermissions(userId, farmId, permissionsVersion);
        }
        catch {
            return [];
        }
    }
    updateLanguage(userId, preferredLanguage) {
        return this.authRepository.updatePreferredLanguage(userId, preferredLanguage.toUpperCase());
    }
    async verifyEmailToken(token) {
        const user = await this.authRepository.verifyEmailToken(token);
        if (!user) {
            this.log.warn('Email verification failed for invalid token', {
                emailId: null,
                userId: null,
                tenantId: null,
                farmId: null,
                correlationId: null,
                timestamp: new Date().toISOString(),
            });
            throw new common_1.UnauthorizedException('Invalid verification token');
        }
        this.log.audit('auth.email_verified', {
            emailId: null,
            userId: user.id,
            tenantId: user.id,
            farmId: null,
            correlationId: null,
            timestamp: new Date().toISOString(),
            emailDomain: user.email.split('@')[1] ?? null,
        });
        return { success: true };
    }
    async forgotPassword(email) {
        const input = { email };
        const user = await this.authRepository.findUserByEmail(input.email);
        if (user) {
            const resetToken = (0, crypto_1.randomBytes)(48).toString('hex');
            const tokenHash = this.hashToken(resetToken);
            const expiresAt = new Date(Date.now() + this.passwordResetTokenTtlMinutes * 60 * 1000);
            await this.authRepository.createResetToken({
                userId: user.id,
                tokenHash,
                expiresAt,
            });
            this.eventBus.emit(password_reset_requested_event_1.PASSWORD_RESET_REQUESTED_EVENT, {
                userId: user.id,
                email: user.email,
                name: user.name,
                token: resetToken,
                tenantId: user.id,
                farmId: null,
            });
            this.log.audit('auth.password_reset_requested', {
                userId: user.id,
                tenantId: user.id,
                farmId: null,
                correlationId: null,
                timestamp: new Date().toISOString(),
            });
        }
        return { success: true };
    }
    async resetPassword(input) {
        const tokenHash = this.hashToken(input.token);
        const resetToken = await this.authRepository.findResetToken(tokenHash);
        if (!resetToken?.user) {
            throw new common_1.UnauthorizedException('Invalid reset token');
        }
        const nextPasswordHash = await this.passwordService.hashPassword(input.newPassword);
        await this.authRepository.updateUserPassword(resetToken.user.id, nextPasswordHash);
        await this.authRepository.markResetTokenUsed(resetToken.id);
        await this.revokeAccessAfterPasswordUpdate(resetToken.user.id);
        this.eventBus.emit(password_reset_successful_event_1.PASSWORD_RESET_SUCCESSFUL_EVENT, {
            userId: resetToken.user.id,
            tenantId: resetToken.user.id,
            farmId: null,
        });
        this.log.audit('auth.password_reset_successful', {
            userId: resetToken.user.id,
            tenantId: resetToken.user.id,
            farmId: null,
            correlationId: null,
            timestamp: new Date().toISOString(),
        });
        return { success: true };
    }
    async changePassword(userId, input) {
        const user = await this.authRepository.findUserById(userId);
        if (!user?.passwordHash) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isCurrentPasswordValid = await this.passwordService.verifyPassword(user.passwordHash, input.currentPassword);
        if (!isCurrentPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const nextPasswordHash = await this.passwordService.hashPassword(input.newPassword);
        await this.authRepository.updateUserPassword(user.id, nextPasswordHash);
        await this.revokeAccessAfterPasswordUpdate(user.id);
        this.eventBus.emit(password_changed_event_1.PASSWORD_CHANGED_EVENT, {
            userId: user.id,
            tenantId: user.id,
            farmId: null,
        });
        this.log.audit('auth.password_changed', {
            userId: user.id,
            tenantId: user.id,
            farmId: null,
            correlationId: null,
            timestamp: new Date().toISOString(),
        });
        return { success: true };
    }
    async loginWithContext(dto, context = {}) {
        const user = await this.authRepository.findUserByEmail(dto.email);
        if (!user?.passwordHash || user.deletedAt) {
            this.log.warn('Rejected login for invalid credentials', {
                email: dto.email,
            });
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (user.isBlocked || this.isLockActive(user.lockedUntil)) {
            await this.authRepository.recordSuspiciousLogin({
                userId: user.id,
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                deviceName: context.deviceName,
                reason: user.isBlocked ? 'blocked-user' : 'account-locked',
            });
            this.log.warn('Rejected login for blocked or locked account', {
                userId: user.id,
                reason: user.isBlocked ? 'blocked-user' : 'account-locked',
            });
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isValid = await this.passwordService.verifyPassword(user.passwordHash, dto.password);
        if (!isValid) {
            const windowExpired = !!user.lastFailedLoginAt &&
                Date.now() - user.lastFailedLoginAt.getTime() >
                    this.config.lockout.windowSeconds * 1000;
            const nextFailedAttempts = windowExpired
                ? 1
                : user.failedLoginAttempts + 1;
            await this.handleFailedLogin(user.id, nextFailedAttempts, context);
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        let farmId = dto.farmId;
        let farms;
        if (farmId === undefined) {
            const memberships = await this.authRepository.listActiveFarmMemberships(user.id);
            if (memberships.length === 1) {
                farmId = memberships[0].id;
            }
            else {
                farmId = '';
                if (memberships.length > 1) {
                    farms = memberships;
                }
            }
        }
        const refreshToken = this.refreshTokenService.generateToken();
        const sessionExpiresAt = this.parseExpiresInToDate(this.config.refreshExpiresIn);
        const refreshTokenExpiresAt = sessionExpiresAt;
        const tokenFamily = (0, crypto_1.randomBytes)(16).toString('hex');
        const refreshTokenHash = this.refreshTokenService.hashToken(refreshToken);
        const { session } = await this.authRepository.completeSuccessfulLogin({
            userId: user.id,
            sessionExpiresAt,
            refreshTokenHash,
            tokenFamily,
            refreshTokenExpiresAt,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            deviceName: context.deviceName,
        });
        const accessToken = await this.tokenService.signAccessToken(this.buildAccessTokenPayload({
            userId: user.id,
            sessionId: session.id,
            farmId,
            permissionsVersion: user.permissionsVersion,
        }));
        await this.permissionsVersionCache.set(user.id, user.permissionsVersion);
        this.log.audit('auth.login', {
            userId: user.id,
            sessionId: session.id,
            farmId,
            deviceName: context.deviceName ?? null,
        });
        return {
            accessToken,
            refreshToken,
            sessionId: session.id,
            user: this.toRegisteredUser(user),
            farmId,
            needsFarm: farmId === '',
            farms,
        };
    }
    async handleFailedLogin(userId, failedLoginAttempts, context) {
        const lockedUntil = failedLoginAttempts >= this.config.lockout.maxFailedAttempts
            ? new Date(Date.now() + this.config.lockout.durationSeconds * 1000)
            : null;
        await this.authRepository.recordFailedLoginAttempt({
            userId,
            failedLoginAttempts: lockedUntil !== null ? 0 : failedLoginAttempts,
            lockedUntil,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            deviceName: context.deviceName,
            reason: 'invalid-password',
        });
        this.log.warn('Rejected login for invalid password', {
            userId,
            failedLoginAttempts,
            lockedUntil: lockedUntil?.toISOString() ?? null,
        });
    }
    buildAccessTokenPayload(data) {
        return {
            sub: data.userId,
            sessionId: data.sessionId,
            farmId: data.farmId,
            permissionsVersion: data.permissionsVersion,
        };
    }
    isLockActive(lockedUntil) {
        return Boolean(lockedUntil && lockedUntil.getTime() > Date.now());
    }
    parseExpiresInToDate(expiresIn) {
        const durationMs = this.parseDurationToMs(expiresIn);
        return new Date(Date.now() + durationMs);
    }
    parseDurationToMs(value) {
        const match = /^(?<amount>\d+)(?<unit>ms|s|m|h|d)$/i.exec(value.trim());
        if (!match?.groups) {
            return 30 * 24 * 60 * 60 * 1000;
        }
        const amount = Number(match.groups.amount);
        const unit = match.groups.unit.toLowerCase();
        const multipliers = {
            ms: 1,
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
        };
        return amount * multipliers[unit];
    }
    toRegisteredUser(user) {
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            isEmailVerified: user.isEmailVerified ?? false,
        };
    }
    hashToken(value) {
        return (0, crypto_1.createHash)('sha256').update(value).digest('hex');
    }
    isUniqueConstraintError(error) {
        return Boolean(error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'P2002');
    }
    async revokeAccessAfterPasswordUpdate(userId) {
        await this.sessionService.revokeAllSessionsForUser(userId);
        await this.permissionsVersionCache.invalidate(userId);
        await this.permissionService.invalidateForUser(userId);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(env_1.authConfig.KEY)),
    __metadata("design:paramtypes", [void 0, auth_repository_1.AuthRepository,
        password_service_1.PasswordService,
        session_service_1.SessionService,
        refresh_token_service_1.RefreshTokenService,
        permissions_version_cache_service_1.PermissionsVersionCacheService,
        permission_service_1.PermissionService,
        token_service_1.TokenService,
        domain_event_bus_service_1.DomainEventBusService,
        logger_service_1.LoggerService,
        cache_service_1.CacheService])
], AuthService);
//# sourceMappingURL=auth.service.js.map