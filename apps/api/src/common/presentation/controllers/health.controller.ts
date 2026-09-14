import { Controller, Get, Inject, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { appConfig } from 'src/core/config/env';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { MetricsService } from 'src/core/observability/metrics/metrics.service';
import { REDIS_CLIENT } from 'src/core/redis/redis.constants';
import type { RedisClient } from 'src/core/redis/redis.module';
import type { Request, Response } from 'express';
import { Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

/** How long a dependency probe result is reused across health requests. */
const PROBE_TTL_MS = 5_000;

/** Infra probes — unguarded, no auth token, consumed by k8s/Prometheus. */
@ApiTags('Ops')
@Controller()
export class HealthController {
  private probeCache?: {
    at: number;
    result: { dbOk: boolean; redisOk: boolean };
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {}

  /**
   * RD-042/053: unauthenticated by default (Prometheus has no bearer
   * support, and the real access control belongs at the reverse proxy —
   * see the env.schema.ts comment on METRICS_TOKEN). When an operator sets
   * METRICS_TOKEN, this becomes the belt-and-braces check for a deployment
   * with no proxy-level IP allowlist in front of it yet.
   */
  @Get('/metrics')
  async metricsEndpoint(@Req() req: Request, @Res() res: Response) {
    if (this.appCfg.metricsToken) {
      const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (provided !== this.appCfg.metricsToken) {
        throw new UnauthorizedException('Invalid or missing metrics token');
      }
    }
    res.setHeader('Content-Type', this.metrics.getContentType());
    res.send(await this.metrics.getMetrics());
  }

  @Get('/health')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async health() {
    return this.buildHealth('health');
  }

  @Get('/ready')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async ready() {
    return this.buildHealth('ready');
  }

  /**
   * Liveness = "this process is running". Deliberately touches no dependency:
   * a probe that queries Postgres would report the process as dead during a DB
   * blip and get it restarted, which is exactly the wrong reaction. Unthrottled
   * so an orchestrator can never be locked out of its own restart signal.
   */
  @Get('/live')
  @SkipThrottle()
  live() {
    return {
      success: true,
      status: 'ok',
      endpoint: 'live',
      service: 'rakhal-api',
      timestamp: new Date().toISOString(),
    };
  }

  private async buildHealth(kind: 'health' | 'ready') {
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

  /**
   * Coalesces dependency probes into one round trip per {@link PROBE_TTL_MS}.
   *
   * `/health` and `/ready` are unauthenticated and un-prefixed, and each call
   * used to run a real `SELECT 1` plus a Redis `PING` — free amplification for
   * anyone hitting them in a loop. Health data this coarse is not meaningfully
   * staler at 5s, and the rate limit above is now a ceiling on *requests*, not
   * on database work.
   */
  private async probeDependencies(): Promise<{
    dbOk: boolean;
    redisOk: boolean;
  }> {
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

  private async checkDb(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /** `RedisModule`'s `RedisBootstrap` connects the shared client at boot (RD-028) — this only
   * probes it, it no longer connects on-demand. */
  private async checkRedis(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }
}
