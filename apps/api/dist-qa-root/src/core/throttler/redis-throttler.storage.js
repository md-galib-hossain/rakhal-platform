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
var RedisThrottlerStorage_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisThrottlerStorage = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const redis_constants_1 = require("src/core/redis/redis.constants");
const INCREMENT_SCRIPT = `
local hitsKey, blockKey = KEYS[1], KEYS[2]
local ttlMs, limit, blockMs = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])

-- Already serving a block: report it without burning another hit.
local blockPttl = redis.call('PTTL', blockKey)
if blockPttl > 0 then
  local h = tonumber(redis.call('GET', hitsKey) or '0')
  local p = redis.call('PTTL', hitsKey)
  if p < 0 then p = 0 end
  return { h, p, 1, blockPttl }
end

local hits = redis.call('INCR', hitsKey)
local pttl = redis.call('PTTL', hitsKey)
-- -1 = key exists with no TTL (a PEXPIRE that never landed), -2 = vanished
-- between INCR and PTTL. Either way, re-arm the window or the key leaks forever.
if hits == 1 or pttl < 0 then
  redis.call('PEXPIRE', hitsKey, ttlMs)
  pttl = ttlMs
end

if hits > limit then
  redis.call('SET', blockKey, '1', 'PX', blockMs)
  return { hits, pttl, 1, blockMs }
end

return { hits, pttl, 0, 0 }
`;
let RedisThrottlerStorage = RedisThrottlerStorage_1 = class RedisThrottlerStorage {
    redis;
    log;
    constructor(redis, logger) {
        this.redis = redis;
        this.log = logger.setContext(RedisThrottlerStorage_1.name);
    }
    async increment(key, ttl, limit, blockDuration) {
        try {
            const [hits, pttl, blocked, blockPttl] = (await this.redis.eval(INCREMENT_SCRIPT, {
                keys: [`throttle:${key}`, `throttle:${key}:blk`],
                arguments: [String(ttl), String(limit), String(blockDuration)],
            }));
            return {
                totalHits: hits,
                timeToExpire: Math.ceil(pttl / 1000),
                isBlocked: blocked === 1,
                timeToBlockExpire: Math.ceil(blockPttl / 1000),
            };
        }
        catch (error) {
            this.log.warn('Throttler storage unavailable — allowing request', {
                error: String(error),
            });
            return {
                totalHits: 0,
                timeToExpire: Math.ceil(ttl / 1000),
                isBlocked: false,
                timeToBlockExpire: 0,
            };
        }
    }
};
exports.RedisThrottlerStorage = RedisThrottlerStorage;
exports.RedisThrottlerStorage = RedisThrottlerStorage = RedisThrottlerStorage_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [Object, logger_service_1.LoggerService])
], RedisThrottlerStorage);
//# sourceMappingURL=redis-throttler.storage.js.map