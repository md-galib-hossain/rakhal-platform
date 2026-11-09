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
var CacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const redis_constants_1 = require("src/core/redis/redis.constants");
let CacheService = CacheService_1 = class CacheService {
    redis;
    log;
    constructor(redis, logger) {
        this.redis = redis;
        this.log = logger.setContext(CacheService_1.name);
    }
    async get(key) {
        try {
            const raw = await this.redis.get(key);
            return raw === null ? undefined : JSON.parse(raw);
        }
        catch (error) {
            this.log.warn('Cache get failed', { key, error: String(error) });
            return undefined;
        }
    }
    async set(key, value, ttlSeconds) {
        try {
            const payload = JSON.stringify(value);
            if (ttlSeconds && ttlSeconds > 0) {
                await this.redis.set(key, payload, { EX: ttlSeconds });
            }
            else {
                await this.redis.set(key, payload);
            }
        }
        catch (error) {
            this.log.warn('Cache set failed', { key, error: String(error) });
        }
    }
    async delete(keys) {
        try {
            const list = Array.isArray(keys) ? keys : [keys];
            if (list.length > 0) {
                await this.redis.del(list);
            }
        }
        catch (error) {
            this.log.warn('Cache delete failed', { keys, error: String(error) });
        }
    }
    async deleteByPrefix(prefix) {
        try {
            const keys = await this.redis.keys(`${prefix}*`);
            if (keys.length > 0) {
                await this.redis.del(keys);
            }
        }
        catch (error) {
            this.log.warn('Cache deleteByPrefix failed', {
                prefix,
                error: String(error),
            });
        }
    }
    async getOrSet(key, ttlSeconds, factory) {
        const cached = await this.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const value = await factory();
        await this.set(key, value, ttlSeconds);
        return value;
    }
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = CacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [Object, logger_service_1.LoggerService])
], CacheService);
//# sourceMappingURL=cache.service.js.map