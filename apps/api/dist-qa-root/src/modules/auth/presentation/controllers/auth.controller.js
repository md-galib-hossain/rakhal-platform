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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const decorators_1 = require("src/common/decorators");
const env_1 = require("src/core/config/env");
const auth_cookie_options_1 = require("src/core/security/auth-cookie-options");
const auth_service_1 = require("../../application/services/auth.service");
const csrf_service_1 = require("../../application/services/csrf.service");
const csrf_guard_1 = require("../guards/csrf.guard");
const jwt_auth_guard_1 = require("../guards/jwt-auth.guard");
const session_guard_1 = require("../guards/session.guard");
const login_dto_1 = require("../dto/login.dto");
const logout_dto_1 = require("../dto/logout.dto");
const refresh_token_dto_1 = require("../dto/refresh-token.dto");
const register_dto_1 = require("../dto/register.dto");
const verify_email_dto_1 = require("../dto/verify-email.dto");
const forgot_password_dto_1 = require("../dto/forgot-password.dto");
const reset_password_dto_1 = require("../dto/reset-password.dto");
const change_password_dto_1 = require("../dto/change-password.dto");
const update_language_dto_1 = require("../dto/update-language.dto");
const swagger_1 = require("@nestjs/swagger");
let AuthController = class AuthController {
    authService;
    csrfService;
    config;
    constructor(authService, csrfService, config) {
        this.authService = authService;
        this.csrfService = csrfService;
        this.config = config;
    }
    async register(dto) {
        const result = await this.authService.register(dto);
        return {
            user: result.user,
        };
    }
    async login(dto, request, response) {
        const result = await this.authService.loginWithContext(dto, {
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            deviceName: typeof request.headers['x-device-name'] === 'string'
                ? request.headers['x-device-name']
                : undefined,
        });
        response.cookie(this.config.refreshCookie.name, result.refreshToken, (0, auth_cookie_options_1.getRefreshCookieOptions)(this.config));
        return {
            accessToken: result.accessToken,
            sessionId: result.sessionId,
            user: result.user,
            farmId: result.farmId,
            needsFarm: result.needsFarm,
            farms: result.farms,
        };
    }
    verifyEmail(dto) {
        return this.authService.verifyEmailToken(dto.token);
    }
    forgotPassword(dto) {
        return this.authService.forgotPassword(dto.email);
    }
    resetPassword(dto) {
        return this.authService.resetPassword(dto);
    }
    changePassword(dto, request) {
        const auth = this.getAuthContext(request);
        return this.authService.changePassword(auth.user.sub, dto);
    }
    csrf(request, response) {
        return {
            csrfToken: this.csrfService.generateToken(request, response),
        };
    }
    async refresh(dto, request, response) {
        const refreshToken = this.getRefreshTokenFromRequest(request);
        try {
            const result = await this.authService.refresh(dto, refreshToken);
            response.cookie(this.config.refreshCookie.name, result.refreshToken, (0, auth_cookie_options_1.getRefreshCookieOptions)(this.config));
            return {
                accessToken: result.accessToken,
                sessionId: result.sessionId,
                user: result.user,
                farmId: result.farmId,
            };
        }
        catch (error) {
            response.clearCookie(this.config.refreshCookie.name, (0, auth_cookie_options_1.getClearRefreshCookieOptions)(this.config));
            throw error;
        }
    }
    logout(dto, request, response) {
        const auth = this.getAuthContext(request);
        if (dto.sessionId && dto.sessionId !== auth.session.id) {
            throw new common_1.UnauthorizedException('Session not found');
        }
        response.clearCookie(this.config.refreshCookie.name, (0, auth_cookie_options_1.getClearRefreshCookieOptions)(this.config));
        return this.authService.logoutCurrentSession(auth.user.sub, auth.session.id);
    }
    logoutAll(request, response) {
        const auth = this.getAuthContext(request);
        response.clearCookie(this.config.refreshCookie.name, (0, auth_cookie_options_1.getClearRefreshCookieOptions)(this.config));
        return this.authService.logoutAllSessions(auth.user.sub);
    }
    sessions(request) {
        const auth = this.getAuthContext(request);
        return this.authService.listSessions(auth.user.sub);
    }
    revokeSession(sessionId, request) {
        const auth = this.getAuthContext(request);
        return this.authService.revokeSessionForCurrentUser(auth.user.sub, sessionId);
    }
    me(request) {
        const auth = this.getAuthContext(request);
        return this.authService.me(auth.user.sub, auth.user.farmId, auth.user.permissionsVersion);
    }
    updateLanguage(dto, request) {
        const auth = this.getAuthContext(request);
        return this.authService.updateLanguage(auth.user.sub, dto.preferredLanguage);
    }
    getRefreshTokenFromRequest(request) {
        const cookies = request.cookies;
        return cookies?.[this.config.refreshCookie.name];
    }
    getAuthContext(request) {
        const authRequest = request;
        if (!authRequest.auth) {
            throw new common_1.UnauthorizedException('Unauthorized');
        }
        const auth = authRequest.auth;
        return auth;
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('register'),
    (0, decorators_1.ThrottleAuth)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('login'),
    (0, decorators_1.ThrottleAuth)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('verify-email'),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 10 } }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_email_dto_1.VerifyEmailDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verifyEmail", null);
__decorate([
    (0, common_1.Post)('forgot-password'),
    (0, decorators_1.ThrottleAuth)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [forgot_password_dto_1.ForgotPasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    (0, decorators_1.ThrottleAuth)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [reset_password_dto_1.ResetPasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Post)('change-password'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(csrf_guard_1.CsrfGuard, jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 10 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [change_password_dto_1.ChangePasswordDto, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Get)('csrf'),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 20 } }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "csrf", null);
__decorate([
    (0, common_1.Post)('refresh'),
    (0, common_1.UseGuards)(csrf_guard_1.CsrfGuard),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 10 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [refresh_token_dto_1.RefreshTokenDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(csrf_guard_1.CsrfGuard, jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 10 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [logout_dto_1.LogoutDto, Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('logout-all'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(csrf_guard_1.CsrfGuard, jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 10 } }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "logoutAll", null);
__decorate([
    (0, common_1.Get)('sessions'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "sessions", null);
__decorate([
    (0, common_1.Delete)('sessions/:sessionId'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 10 } }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "revokeSession", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Patch)('me/language'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_language_dto_1.UpdateLanguageDto, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "updateLanguage", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Auth'),
    (0, common_1.Controller)('auth'),
    __param(2, (0, common_1.Inject)(env_1.authConfig.KEY)),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        csrf_service_1.CsrfService, void 0])
], AuthController);
//# sourceMappingURL=auth.controller.js.map