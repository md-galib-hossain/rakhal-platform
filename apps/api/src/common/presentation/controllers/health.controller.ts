import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { MetricsService } from 'src/core/observability/metrics/metrics.service';
import { REDIS_CLIENT } from 'src/core/redis/redis.constants';
import type { RedisClient } from 'src/core/redis/redis.module';
import type { Response } from 'express';
import { Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/** Infra probes — unguarded, no auth token, consumed by k8s/Prometheus. */
@ApiTags('Ops')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
  ) {}

  @Get('/metrics')
  async metricsEndpoint(@Res() res: Response) {
    res.setHeader('Content-Type', this.metrics.getContentType());
    res.send(await this.metrics.getMetrics());
  }

  @Get('/health')
  async health() {
    return this.buildHealth('health');
  }

  @Get('/ready')
  async ready() {
    return this.buildHealth('ready');
  }

  @Get('/live')
  async live() {
    return this.buildHealth('live');
  }

  private async buildHealth(kind: 'health' | 'ready' | 'live') {
    const dbOk = await this.checkDb();
    const redisOk = await this.checkRedis();

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
