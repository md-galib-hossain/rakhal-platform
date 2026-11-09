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
exports.HealthController = void 0;
exports.tokensMatch = tokensMatch;
const hash_util_1 = require("src/common/crypto/hash.util");
const common_1 = require("@nestjs/common");
const env_1 = require("src/core/config/env");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const metrics_service_1 = require("src/core/observability/metrics/metrics.service");
const redis_constants_1 = require("src/core/redis/redis.constants");
const common_2 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
function tokensMatch(provided, expected) {
    return (0, hash_util_1.safeEqualHex)((0, hash_util_1.sha256Hex)(provided), (0, hash_util_1.sha256Hex)(expected));
}
const PROBE_TTL_MS = 5_000;
let HealthController = class HealthController {
    prisma;
    metrics;
    redis;
    appCfg;
    probeCache;
    constructor(prisma, metrics, redis, appCfg) {
        this.prisma = prisma;
        this.metrics = metrics;
        this.redis = redis;
        this.appCfg = appCfg;
    }
    async metricsEndpoint(req, res) {
        if (this.appCfg.metricsToken) {
            const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '');
            if (!provided || !tokensMatch(provided, this.appCfg.metricsToken)) {
                throw new common_1.UnauthorizedException('Invalid or missing metrics token');
            }
        }
        res.setHeader('Content-Type', this.metrics.getContentType());
        res.send(await this.metrics.getMetrics());
    }
    async health() {
        return this.buildHealth('health');
    }
    async ready() {
        return this.buildHealth('ready');
    }
    live() {
        return {
            success: true,
            status: 'ok',
            endpoint: 'live',
            service: 'rakhal-api',
            timestamp: new Date().toISOString(),
        };
    }
    async buildHealth(kind) {
        const { dbOk, redisOk } = await this.probeDependencies();
        return {
            success: dbOk && redisOk,
            status: dbOk && redisOk ? 'ok' : 'degraded',
            endpoint: kind,
            service: 'rakhal-api',
            timestamp: new Date().toISOString(),
            dependencies: {
                database: dbOk ? 'up' : 'down',
                redis: redisOk ? 'up' : 'down',
            },
        };
    }
    async probeDependencies() {
        const now = Date.now();
        if (this.probeCache && now - this.probeCache.at < PROBE_TTL_MS) {
            return this.probeCache.result;
        }
        const [dbOk, redisOk] = await Promise.all([
            this.checkDb(),
            this.checkRedis(),
        ]);
        const result = { dbOk, redisOk };
        this.probeCache = { at: now, result };
        return result;
    }
    async checkDb() {
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return true;
        }
        catch {
            return false;
        }
    }
    async checkRedis() {
        try {
            await this.redis.ping();
            return true;
        }
        catch {
            return false;
        }
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)('/metrics'),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 30 } }),
    __param(0, (0, common_2.Req)()),
    __param(1, (0, common_2.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "metricsEndpoint", null);
__decorate([
    (0, common_1.Get)('/health'),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 60 } }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "health", null);
__decorate([
    (0, common_1.Get)('/ready'),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 60 } }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "ready", null);
__decorate([
    (0, common_1.Get)('/live'),
    (0, throttler_1.SkipThrottle)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "live", null);
exports.HealthController = HealthController = __decorate([
    (0, swagger_1.ApiTags)('Ops'),
    (0, common_1.Controller)(),
    __param(2, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __param(3, (0, common_1.Inject)(env_1.appConfig.KEY)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        metrics_service_1.MetricsService, Object, void 0])
], HealthController);
//# sourceMappingURL=health.controller.js.map