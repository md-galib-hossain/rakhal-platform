import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { HealthController } from './health.controller';

/**
 * RD-042/053 — `GET /metrics`'s optional `METRICS_TOKEN` bearer check.
 * Direct-instantiation unit test (matches `lactation-economics.service.spec.ts`'s
 * precedent) since only `metricsEndpoint()`'s auth branch is under test here —
 * the dependency probes (`/health`/`/ready`/`/live`) are unaffected by this
 * ticket and already have no coverage of their own to extend.
 */
describe('HealthController — /metrics METRICS_TOKEN gate (RD-042/053)', () => {
  const metrics = {
    getContentType: jest.fn().mockReturnValue('text/plain'),
    getMetrics: jest.fn().mockResolvedValue('# HELP dummy\n'),
  };
  const prisma = {} as never;
  const redis = {} as never;

  const req = (authorization?: string): Request =>
    ({ headers: { authorization } }) as unknown as Request;
  const res = (): Response =>
    ({
      setHeader: jest.fn(),
      send: jest.fn(),
    }) as unknown as Response;

  beforeEach(() => jest.clearAllMocks());

  it("serves metrics unauthenticated when METRICS_TOKEN is unset (today's default behavior)", async () => {
    const controller = new HealthController(prisma, metrics as never, redis, {
      metricsToken: undefined,
    } as never);

    const response = res();
    await controller.metricsEndpoint(req(undefined), response);

    expect(response.send).toHaveBeenCalledWith('# HELP dummy\n');
  });

  it('rejects a missing Authorization header when METRICS_TOKEN is set', async () => {
    const controller = new HealthController(prisma, metrics as never, redis, {
      metricsToken: 'secret-token',
    } as never);

    await expect(
      controller.metricsEndpoint(req(undefined), res()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a wrong bearer token when METRICS_TOKEN is set', async () => {
    const controller = new HealthController(prisma, metrics as never, redis, {
      metricsToken: 'secret-token',
    } as never);

    await expect(
      controller.metricsEndpoint(req('Bearer wrong-token'), res()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('serves metrics when the bearer token matches METRICS_TOKEN', async () => {
    const controller = new HealthController(prisma, metrics as never, redis, {
      metricsToken: 'secret-token',
    } as never);

    const response = res();
    await controller.metricsEndpoint(req('Bearer secret-token'), response);

    expect(response.send).toHaveBeenCalledWith('# HELP dummy\n');
  });
});
