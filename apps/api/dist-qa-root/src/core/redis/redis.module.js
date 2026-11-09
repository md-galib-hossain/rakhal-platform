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
exports.RedisModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const redis_1 = require("redis");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const env_1 = require("../config/env");
const redis_constants_1 = require("./redis.constants");
const redisClientProvider = {
    provide: redis_constants_1.REDIS_CLIENT,
    inject: [env_1.redisConfig.KEY, logger_service_1.LoggerService],
    useFactory: (config, logger) => {
        const log = logger.setContext('RedisModule');
        const client = (0, redis_1.createClient)({
            url: config.url,
            socket: {
                connectTimeout: config.connectTimeoutMs,
            },
        });
        client.on('error', (error) => {
            log.error('Redis client error', error, {
                host: config.host,
                port: config.port,
                tlsEnabled: config.tlsEnabled,
            });
        });
        return client;
    },
};
let RedisBootstrap = class RedisBootstrap {
    client;
    log;
    constructor(client, logger) {
        this.client = client;
        this.log = logger.setContext('RedisBootstrap');
    }
    async onModuleInit() {
        try {
            await this.client.connect();
        }
        catch (error) {
            this.log.error('Initial Redis connect failed — will retry in background', error);
        }
    }
    async onApplicationShutdown() {
        if (this.client.isOpen) {
            await this.client.quit();
        }
    }
};
RedisBootstrap = __decorate([
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [Object, logger_service_1.LoggerService])
], RedisBootstrap);
let RedisModule = class RedisModule {
};
exports.RedisModule = RedisModule;
exports.RedisModule = RedisModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [config_1.ConfigModule.forFeature(env_1.redisConfig), logger_module_1.LoggerModule],
        providers: [redisClientProvider, RedisBootstrap],
        exports: [redis_constants_1.REDIS_CLIENT],
    })
], RedisModule);
//# sourceMappingURL=redis.module.js.map