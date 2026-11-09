import { installLegacyReproShim } from './legacy-repro-shim';
import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { RakhalThrottlerGuard } from '../../src/core/throttler/rakhal-throttler.guard';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { appConfig } from '../../src/core/config/env';
import { PrismaService } from '../../src/core/database/prisma/prisma.service';
import { PasswordService } from '../../src/modules/auth/application/services/password.service';
import { LegalConsentService } from '../../src/modules/compliance/application/services/legal-consent.service';
import { FarmService } from '../../src/modules/farm/application/services/farm.service';
import { InMemoryScheduleQueue } from '../../src/modules/notification/application/queue/in-memory-schedule-queue';
import {
  FakeNotificationClock,
  NOTIFICATION_CLOCK,
} from '../../src/modules/notification/application/queue/notification-clock';
import { SCHEDULE_QUEUE_PORT } from '../../src/modules/notification/application/queue/schedule-queue.port';

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
  /** Hook to override providers (e.g. a fake queue) before the module compiles. */
  configure?: (builder: TestingModuleBuilder) => void;
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

  options.configure?.(builder);
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  installLegacyReproShim(app);

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

export interface ThrowawayOwner {
  userId: string;
  farmId: string;
  owner: AuthedUser;
}

/**
 * Registers a brand-new, disposable farm owner + farm, for specs that need
 * their own fresh/empty farm (whole-population aggregates, cross-farm
 * isolation checks, etc.) without attaching it to the shared seeded demo
 * owner. Farms created under `owner@demo.rakhal.test` (`farmService.create(
 * demoOwnerUserId, ...)`) accumulate forever in the dev DB — RD-096 found
 * 30+ from past e2e runs polluting that account's farm-picker — because a
 * single farm can't be surgically excised from an account other suites are
 * actively using, so teardown kept getting skipped. A throwaway user + its
 * farm can just be deleted outright afterward instead.
 */
export async function createThrowawayOwner(
  ctx: TestContext,
  prisma: PrismaService,
  farmName: string,
): Promise<ThrowawayOwner> {
  const passwordService = ctx.app.get(PasswordService);
  const legal = ctx.app.get(LegalConsentService);
  const farmService = ctx.app.get(FarmService);

  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@rakhal.test`;
  const password = 'ThrowawayOwner123';
  const user = await prisma.user.create({
    data: {
      email,
      name: 'E2E Throwaway Owner',
      passwordHash: await passwordService.hashPassword(password),
      isEmailVerified: true,
    },
    select: { id: true },
  });
  await legal.recordConsent(user.id, []);

  const farm = await farmService.create(user.id, { name: farmName });

  const login = await request(ctx.app.getHttpServer())
    .post(`${ctx.prefix}/auth/login`)
    .send({ email, password, farmId: farm.id });
  const token = extractToken(login.body, `throwaway login for ${email}`);

  return {
    userId: user.id,
    farmId: farm.id,
    owner: { token, farmId: farm.id },
  };
}

/**
 * Best-effort teardown for `createThrowawayOwner`. Deletes the default
 * chart-of-accounts rows `FarmService.create` always seeds (which would
 * otherwise block a plain `Farm.delete`), then the farm and the user. Each
 * step swallows its own error so a spec's own domain rows (which it must
 * delete itself, before calling this) don't stop the rest of the cleanup —
 * mirrors the `.catch(() => undefined)` idiom already used ad hoc across
 * specs (`admin-user-session`, `billing`, `otp`, ...).
 */
export async function deleteThrowawayOwner(
  prisma: PrismaService,
  { userId, farmId }: { userId: string; farmId: string },
): Promise<void> {
  await prisma.journalEntry
    .deleteMany({ where: { journalTransaction: { farmId } } })
    .catch(() => undefined);
  await prisma.journalTransaction
    .deleteMany({ where: { farmId } })
    .catch(() => undefined);
  await prisma.ledgerAccount
    .deleteMany({ where: { farmId } })
    .catch(() => undefined);
  await prisma.farmMember
    .deleteMany({ where: { farmId } })
    .catch(() => undefined);
  await prisma.farm.delete({ where: { id: farmId } }).catch(() => undefined);
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
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

/**
 * Notifications v2 test seam (RAKHAL-493): swaps the BullMQ queue for an in-memory one, the clock for a fake one, so a spec moves time and calls `queue.runDue(clock.now(), id => processor.process(id))`
 * instead of waiting. Pass `harness.configure` as `createTestApp({ configure })`.
 */
export interface NotificationV2Harness {
  queue: InMemoryScheduleQueue;
  clock: FakeNotificationClock;
  configure: (builder: TestingModuleBuilder) => void;
}

export function createNotificationV2Harness(
  start: Date = new Date(),
): NotificationV2Harness {
  const clock = new FakeNotificationClock(start);
  const queue = new InMemoryScheduleQueue(() => clock.now());
  return {
    queue,
    clock,
    configure: (builder) => {
      builder
        .overrideProvider(SCHEDULE_QUEUE_PORT)
        .useValue(queue)
        .overrideProvider(NOTIFICATION_CLOCK)
        .useValue(clock);
    },
  };
}
