import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { RakhalThrottlerGuard } from '../../src/core/throttler/rakhal-throttler.guard';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { appConfig } from '../../src/core/config/env';

/**
 * Shared e2e harness. Boots the real `AppModule` and faithfully reproduces the
 * `main.ts` bootstrap (global `/api/v1` prefix, the strict `ValidationPipe`,
 * cookie parsing) so tests hit exactly what production serves. The login
 * `ThrottlerGuard` is overridden to a no-op — otherwise the 5-logins/min limit
 * fails the suite. Requires the dev stack (Postgres + Redis) to be up, and a
 * seeded DB (`pnpm seed`) for the demo owner/manager/worker + finance data.
 */
export interface TestContext {
  app: INestApplication;
  /** Leading-slash API prefix, e.g. `/api/v1`. */
  prefix: string;
}

export interface CreateTestAppOptions {
  /**
   * Leave rate limiting switched on. Only `throttling.e2e-spec.ts` wants this —
   * everything else would trip the 5-logins/min auth tier during setup.
   */
  throttling?: boolean;
}

export async function createTestApp(
  options: CreateTestAppOptions = {},
): Promise<TestContext> {
  const builder = Test.createTestingModule({ imports: [AppModule] });

  if (!options.throttling) {
    // Must target the concrete class, not `ThrottlerGuard`: the guard is bound
    // as `{ provide: APP_GUARD, useExisting: RakhalThrottlerGuard }`, and
    // `overrideGuard(ThrottlerGuard)` does not intercept that binding — the
    // suite would silently run fully rate-limited and fail on login.
    builder
      .overrideProvider(RakhalThrottlerGuard)
      .useValue({ canActivate: () => true });
  }

  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());

  const { apiPrefix } = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  app.setGlobalPrefix(apiPrefix, {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
      { path: 'live', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  return { app, prefix: `/${apiPrefix}` };
}

export interface AuthedUser {
  token: string;
  farmId: string;
}

/**
 * Log a demo user in and return a farm-scoped access token. Login itself does
 * not validate `farmId` (the per-request `FarmContextGuard` does), so we bootstrap
 * with a throwaway farmId, discover the user's real farm via `GET /farms`, then
 * mint the scoped token.
 */
export async function loginAs(
  ctx: TestContext,
  email: string,
  password: string,
): Promise<AuthedUser> {
  const server = ctx.app.getHttpServer();

  const boot = await request(server)
    .post(`${ctx.prefix}/auth/login`)
    .send({ email, password, farmId: 'bootstrap' });
  const bootToken = extractToken(boot.body, `bootstrap login for ${email}`);

  const farms = await request(server)
    .get(`${ctx.prefix}/farms`)
    .set('Authorization', `Bearer ${bootToken}`);
  const farmList = (farms.body as { data?: Array<{ id: string }> }).data;
  if (!farmList?.length) {
    throw new Error(`No farms for ${email} — did you run \`pnpm seed\`?`);
  }
  const farmId = farmList[0].id;

  const login = await request(server)
    .post(`${ctx.prefix}/auth/login`)
    .send({ email, password, farmId });
  return {
    token: extractToken(login.body, `scoped login for ${email}`),
    farmId,
  };
}

/** Bearer-auth header helper for supertest `.set(...)`. */
export function bearer(user: AuthedUser): [string, string] {
  return ['Authorization', `Bearer ${user.token}`];
}

function extractToken(body: unknown, ctx: string): string {
  const token = (body as { data?: { accessToken?: string } })?.data
    ?.accessToken;
  if (!token) {
    throw new Error(
      `${ctx} returned no accessToken: ${JSON.stringify(body).slice(0, 200)}`,
    );
  }
  return token;
}
