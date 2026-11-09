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
exports.PermissionsVersionCacheService = void 0;
const common_1 = require("@nestjs/common");
const redis_constants_1 = require("src/core/redis/redis.constants");
let PermissionsVersionCacheService = class PermissionsVersionCacheService {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async get(userId) {
        try {
            const value = await this.redis.get(this.getKey(userId));
            if (value === null) {
                return undefined;
            }
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : undefined;
        }
        catch {
            return undefined;
        }
    }
    async set(userId, permissionsVersion) {
        try {
            await this.redis.set(this.getKey(userId), String(permissionsVersion), {
                EX: 300,
            });
        }
        catch {
            return undefined;
        }
    }
    async invalidate(userId) {
        try {
            await this.redis.del(this.getKey(userId));
        }
        catch {
            return undefined;
        }
    }
    getKey(userId) {
        return `auth:permissions-version:${userId}`;
    }
};
exports.PermissionsVersionCacheService = PermissionsVersionCacheService;
exports.PermissionsVersionCacheService = PermissionsVersionCacheService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [Object])
], PermissionsVersionCacheService);
//# sourceMappingURL=permissions-version-cache.service.js.map