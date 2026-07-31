import { Inject, Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { REDIS_CLIENT } from 'src/core/redis/redis.constants';
import type { RedisClient } from 'src/core/redis/redis.module';

/**
 * `ThrottlerStorageRecord` is declared in the package but not re-exported from
 * its barrel, so derive it from the one name that is rather than reaching into
 * a `dist/` path that a patch release could move.
 */
type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

/**
 * Atomic hit-counter + block-gate in one round trip.
 *
 * `INCR` then `PEXPIRE` in a MULTI is *not* equivalent: the guard needs the
 * remaining TTL in the same atomic unit it incremented in, otherwise two
 * concurrent requests can both read a stale/absent PTTL and reset the window.
 *
 * KEYS[1] hits · KEYS[2] block sentinel
 * ARGV[1] ttlMs · ARGV[2] limit · ARGV[3] blockMs
 * returns { hits, pttlMs, isBlocked, blockPttlMs }
 */
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

/**
 * Redis-backed {@link ThrottlerStorage}, replacing the package default
 * (an in-process `Map`).
 *
 * Production runs PM2 (INFRA-005) — with in-memory storage every worker keeps
 * its own counter, so the real limit is `limit × workers` and a limit of 5
 * silently becomes 20. Counters must live outside the process.
 *
 * Built on the existing node-redis `REDIS_CLIENT` rather than
 * `@nest-lab/throttler-storage-redis`, which targets ioredis' positional
 * `.eval(script, numKeys, ...)` signature. Adding ioredis as a direct dependency
 * would mean a second connection pool to the same Redis for no gain.
 *
 * **Unit mismatch to watch:** the guard hands us `ttl`/`blockDuration` in
 * milliseconds but expects `timeToExpire`/`timeToBlockExpire` back in seconds.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly log: LoggerService;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(RedisThrottlerStorage.name);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    // (the interface also passes `throttlerName`; unused — the key already
    // encodes it, see ThrottlerGuard.generateKey)
  ): Promise<ThrottlerStorageRecord> {
    try {
      const [hits, pttl, blocked, blockPttl] = (await this.redis.eval(
        INCREMENT_SCRIPT,
        {
          keys: [`throttle:${key}`, `throttle:${key}:blk`],
          arguments: [String(ttl), String(limit), String(blockDuration)],
        },
      )) as [number, number, number, number];

      return {
        totalHits: hits,
        timeToExpire: Math.ceil(pttl / 1000),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.ceil(blockPttl / 1000),
      };
    } catch (error) {
      // Fail OPEN, deliberately. A Redis blip must not 429 every farm at once —
      // that converts a cache outage into a full outage. Nginx's `limit_req`
      // (docs/infrastructure/10-nginx-reverse-proxy.md) is the backstop while
      // we're degraded, and CacheService already degrades the same way.
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
}
