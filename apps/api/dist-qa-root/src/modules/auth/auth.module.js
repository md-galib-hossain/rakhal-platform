"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const passport_1 = require("@nestjs/passport");
const env_1 = require("src/core/config/env");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const permission_module_1 = require("../permission/permission.module");
const auth_controller_1 = require("./presentation/controllers/auth.controller");
const auth_service_1 = require("./application/services/auth.service");
const csrf_service_1 = require("./application/services/csrf.service");
const permissions_version_cache_service_1 = require("./application/services/permissions-version-cache.service");
const password_service_1 = require("./application/services/password.service");
const refresh_token_service_1 = require("./application/services/refresh-token.service");
const session_service_1 = require("./application/services/session.service");
const token_service_1 = require("./application/services/token.service");
const auth_repository_1 = require("./infrastructure/persistence/repositories/auth.repository");
const csrf_guard_1 = require("./presentation/guards/csrf.guard");
const access_token_strategy_1 = require("./presentation/strategies/access-token.strategy");
const jwt_auth_guard_1 = require("./presentation/guards/jwt-auth.guard");
const session_guard_1 = require("./presentation/guards/session.guard");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forFeature(env_1.authConfig),
            passport_1.PassportModule.register({ defaultStrategy: 'jwt' }),
            logger_module_1.LoggerModule,
            permission_module_1.PermissionModule,
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            auth_service_1.AuthService,
            password_service_1.PasswordService,
            token_service_1.TokenService,
            session_service_1.SessionService,
            refresh_token_service_1.RefreshTokenService,
            csrf_service_1.CsrfService,
            permissions_version_cache_service_1.PermissionsVersionCacheService,
            auth_repository_1.AuthRepository,
            access_token_strategy_1.AccessTokenStrategy,
            jwt_auth_guard_1.JwtAuthGuard,
            session_guard_1.SessionGuard,
            csrf_guard_1.CsrfGuard,
        ],
        exports: [
            auth_service_1.AuthService,
            password_service_1.PasswordService,
            token_service_1.TokenService,
            session_service_1.SessionService,
            refresh_token_service_1.RefreshTokenService,
            csrf_service_1.CsrfService,
            auth_repository_1.AuthRepository,
            permissions_version_cache_service_1.PermissionsVersionCacheService,
            jwt_auth_guard_1.JwtAuthGuard,
            session_guard_1.SessionGuard,
            csrf_guard_1.CsrfGuard,
        ],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map