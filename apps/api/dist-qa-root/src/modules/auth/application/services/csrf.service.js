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
exports.CsrfService = void 0;
const common_1 = require("@nestjs/common");
const csrf_csrf_1 = require("csrf-csrf");
const crypto_1 = require("crypto");
const env_1 = require("src/core/config/env");
const auth_cookie_options_1 = require("src/core/security/auth-cookie-options");
let CsrfService = class CsrfService {
    config;
    utilities;
    constructor(config) {
        this.config = config;
        this.utilities = (0, csrf_csrf_1.doubleCsrf)({
            getSecret: () => this.config.csrf.secret ?? this.config.refreshSecret,
            getSessionIdentifier: (request) => this.getSessionIdentifier(request),
            cookieName: this.config.csrf.cookieName,
            cookieOptions: (0, auth_cookie_options_1.getCsrfCookieOptions)(this.config),
            getCsrfTokenFromRequest: (request) => request.headers[this.config.csrf.headerName],
            errorConfig: {
                statusCode: 403,
                message: 'invalid csrf token',
                code: 'EBADCSRFTOKEN',
            },
        });
    }
    generateToken(request, response) {
        if (!request.cookies) {
            request.cookies = {};
        }
        return this.utilities.generateCsrfToken(request, response);
    }
    validateRequest(request) {
        return this.utilities.validateRequest(request);
    }
    getSessionIdentifier(request) {
        if (request.auth?.session.id) {
            return request.auth.session.id;
        }
        const cookies = request.cookies;
        const refreshToken = cookies?.[this.config.refreshCookie.name];
        if (refreshToken) {
            return (0, crypto_1.createHash)('sha256').update(refreshToken).digest('hex');
        }
        return [
            request.ip ?? 'unknown-ip',
            request.headers['user-agent'] ?? 'unknown-user-agent',
        ].join('|');
    }
};
exports.CsrfService = CsrfService;
exports.CsrfService = CsrfService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(env_1.authConfig.KEY)),
    __metadata("design:paramtypes", [void 0])
], CsrfService);
//# sourceMappingURL=csrf.service.js.map