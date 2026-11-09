"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminTokenService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const env_1 = require("src/core/config/env");
let AdminTokenService = class AdminTokenService {
    jwt = new jwt_1.JwtService();
    secret = env_1.env.JWT_ADMIN_SECRET;
    expiresIn = env_1.env.JWT_ADMIN_EXPIRES_IN;
    sign(payload, expiresIn = this.expiresIn) {
        return this.jwt.signAsync(payload, {
            secret: this.secret,
            expiresIn,
        });
    }
    verify(token) {
        return this.jwt.verifyAsync(token, {
            secret: this.secret,
        });
    }
};
exports.AdminTokenService = AdminTokenService;
exports.AdminTokenService = AdminTokenService = __decorate([
    (0, common_1.Injectable)()
], AdminTokenService);
//# sourceMappingURL=admin-token.service.js.map