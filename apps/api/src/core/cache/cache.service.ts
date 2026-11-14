import { Inject, Injectable } from '@nestjs/common';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { REDIS_CLIENT } from 'src/core/redis/redis.constants';
import type { RedisClient } from 'src/core/redis/redis.module';

/**
 * Thin, typed, **best-effort** Redis cache facade.
 *
 * Wraps the raw `REDIS_CLIENT` with JSON (de)serialization and swallows Redis
 * failures (logged, never thrown) — caching must never break a request. Treat a
 * cache miss and a Redis outage the same: fall through to the source of truth.
 *
 * Key convention: namespace keys as `domain:entity:id` (e.g.
 * `permissions:user:<id>:<farmId>`) so {@link deleteByPrefix} can invalidate a
 * group. CacheModule is `@Global`, so just inject `CacheService` anywhere.
 *
 * @example
 * const cattle = await this.cache.getOrSet(
 *   `cattle:${farmId}:${id}`,
 *   300, // ttl seconds
 *   () => this.prisma.cattle.findUniqueOrThrow({ where: { id } }),
 * );
 * await this.cache.deleteByPrefix(`cattle:${farmId}:`); // on write
 */
@Injectable()
export class CacheService {
  private readonly log: LoggerService;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(CacheService.name);
  }

  /** Read and JSON-parse a key. Returns `undefined` on miss or Redis error. */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch (error) {
      this.log.warn('Cache get failed', { key, error: String(error) });
      return undefined;
    }
  }

  /** JSON-serialize and store a value, optionally with a TTL (seconds). */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const payload = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.redis.set(key, payload, { EX: ttlSeconds });
      } else {
        await this.redis.set(key, payload);
      }
    } catch (error) {
      this.log.warn('Cache set failed', { key, error: String(error) });
    }
  }

  /** Delete one or more keys. */
  async delete(keys: string | string[]): Promise<void> {
    try {
      const list = Array.isArray(keys) ? keys : [keys];
      if (list.length > 0) {
        await this.redis.del(list);
      }
    } catch (error) {
      this.log.warn('Cache delete failed', { keys, error: String(error) });
    }
  }

  /**
   * Invalidate every key starting with `prefix` (a `prefix*` match).
   * Uses `KEYS` — keep prefixes specific; avoid broad patterns on hot paths.
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch (error) {
      this.log.warn('Cache deleteByPrefix failed', {
        prefix,
        error: String(error),
      });
    }
  }

  /**
   * Return the cached value, or compute it via `factory`, cache it, and return.
   * On a Redis outage the factory still runs (caching is skipped silently).
   *
   * @param ttlSeconds TTL for the freshly computed value.
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}
