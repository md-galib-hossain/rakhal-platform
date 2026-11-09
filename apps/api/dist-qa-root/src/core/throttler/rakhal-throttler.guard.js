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
exports.RakhalThrottlerGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const throttler_1 = require("@nestjs/throttler");
const env_1 = require("src/core/config/env");
let RakhalThrottlerGuard = class RakhalThrottlerGuard extends throttler_1.ThrottlerGuard {
    jwt;
    auth;
    constructor(options, storageService, reflector, jwt, auth) {
        super(options, storageService, reflector);
        this.jwt = jwt;
        this.auth = auth;
    }
    getTracker(req) {
        return Promise.resolve(this.resolveTracker(req));
    }
    resolveTracker(req) {
        const headers = req.headers;
        const raw = headers?.authorization;
        if (typeof raw === 'string' && raw.startsWith('Bearer ')) {
            try {
                const payload = this.jwt.verify(raw.slice(7), {
                    secret: this.auth.accessSecret,
                });
                if (payload?.sub)
                    return `u:${payload.sub}`;
            }
            catch {
            }
        }
        const socket = req.socket;
        return `ip:${req.ip ?? socket?.remoteAddress ?? 'unknown'}`;
    }
};
exports.RakhalThrottlerGuard = RakhalThrottlerGuard;
exports.RakhalThrottlerGuard = RakhalThrottlerGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, throttler_1.InjectThrottlerOptions)()),
    __param(1, (0, throttler_1.InjectThrottlerStorage)()),
    __param(4, (0, common_1.Inject)(env_1.authConfig.KEY)),
    __metadata("design:paramtypes", [Object, Object, core_1.Reflector,
        jwt_1.JwtService, void 0])
], RakhalThrottlerGuard);
//# sourceMappingURL=rakhal-throttler.guard.js.map