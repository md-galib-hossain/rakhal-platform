import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from 'src/core/redis/redis.constants';
import type { RedisClient } from 'src/core/redis/redis.module';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { env } from 'src/core/config/env';

const TOKEN_CACHE_KEY = 'bkash:id_token';

interface GrantTokenResponse {
  id_token?: string;
  expires_in?: number | string;
  refresh_token?: string;
  statusCode?: string;
  statusMessage?: string;
}

/**
 * bKash access-token manager (RAKHAL-221, PRD §32.3). The `id_token` is per-app
 * (not per-farm), valid ~1h; we cache it in Redis (shared across instances) and
 * re-grant when it's missing/expired. Credentials are read from env and **never
 * logged**. All calls are backend-to-backend (bKash sandbox has CORS disabled).
 */
@Injectable()
export class BkashTokenService {
  private readonly log: LoggerService;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(BkashTokenService.name);
  }

  async getToken(): Promise<string> {
    try {
      const cached = await this.redis.get(TOKEN_CACHE_KEY);
      if (cached) return cached;
    } catch {
      // best effort — fall through to a fresh grant
    }

    const res = await fetch(
      `${env.BKASH_BASE_URL}/tokenized/checkout/token/grant`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          username: env.BKASH_USERNAME ?? '',
          password: env.BKASH_PASSWORD ?? '',
        },
        body: JSON.stringify({
          app_key: env.BKASH_APP_KEY ?? '',
          app_secret: env.BKASH_APP_SECRET ?? '',
        }),
      },
    );

    const body = (await res.json()) as GrantTokenResponse;
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
    } catch {
      // best effort
    }
    return body.id_token;
  }
}
