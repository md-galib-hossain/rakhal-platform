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
var BkashTokenService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BkashTokenService = void 0;
const common_1 = require("@nestjs/common");
const redis_constants_1 = require("src/core/redis/redis.constants");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const env_1 = require("src/core/config/env");
const TOKEN_CACHE_KEY = 'bkash:id_token';
let BkashTokenService = BkashTokenService_1 = class BkashTokenService {
    redis;
    log;
    constructor(redis, logger) {
        this.redis = redis;
        this.log = logger.setContext(BkashTokenService_1.name);
    }
    async getToken() {
        try {
            const cached = await this.redis.get(TOKEN_CACHE_KEY);
            if (cached)
                return cached;
        }
        catch {
        }
        const res = await fetch(`${env_1.env.BKASH_BASE_URL}/tokenized/checkout/token/grant`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                username: env_1.env.BKASH_USERNAME ?? '',
                password: env_1.env.BKASH_PASSWORD ?? '',
            },
            body: JSON.stringify({
                app_key: env_1.env.BKASH_APP_KEY ?? '',
                app_secret: env_1.env.BKASH_APP_SECRET ?? '',
            }),
        });
        const body = (await res.json());
        if (!body.id_token) {
            this.log.error('bKash grant-token failed', undefined, {
                statusCode: body.statusCode,
                statusMessage: body.statusMessage,
            });
            throw new Error('bKash grant-token failed');
        }
        const ttl = Math.max(60, Number(body.expires_in ?? 3600) - 60);
        try {
            await this.redis.set(TOKEN_CACHE_KEY, body.id_token, { EX: ttl });
        }
        catch {
        }
        return body.id_token;
    }
};
exports.BkashTokenService = BkashTokenService;
exports.BkashTokenService = BkashTokenService = BkashTokenService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [Object, logger_service_1.LoggerService])
], BkashTokenService);
//# sourceMappingURL=bkash-token.service.js.map