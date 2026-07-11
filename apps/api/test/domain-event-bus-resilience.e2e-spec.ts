import request from 'supertest';
import { DomainEventBusService } from '../src/common/events/domain-event-bus.service';
import { createTestApp, TestContext } from './utils/e2e';

/**
 * Regression test for RD-034: a throwing domain-event listener must not crash
 * the whole process. This was hit live — `POST /auth/forgot-password` fired an
 * event whose listener threw inside an unawaited async handler, killing the
 * entire backend for every subsequent request, not just that one.
 */
describe('DomainEventBusService resilience (e2e)', () => {
  let ctx: TestContext;
  let eventBus: DomainEventBusService;

  beforeAll(async () => {
    ctx = await createTestApp();
    eventBus = ctx.app.get(DomainEventBusService);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('a synchronously-throwing listener does not crash the process or block other listeners', async () => {
    const event = 'rd034.sync_throw';
    const goodListener = jest.fn();

    eventBus.on(event, () => {
      throw new Error('RD-034 regression: sync listener boom');
    });
    eventBus.on(event, goodListener);

    expect(() => eventBus.emit(event, { ok: true })).not.toThrow();
    expect(goodListener).toHaveBeenCalledWith({ ok: true });

    // The server must still be alive and serving requests afterward.
    await request(ctx.app.getHttpServer()).get('/health').expect(200);
  });

  it('an async listener that rejects does not surface as an unhandled rejection that kills the app', async () => {
    const event = 'rd034.async_reject';

    eventBus.on(event, async () => {
      await Promise.resolve();
      throw new Error('RD-034 regression: async listener boom');
    });

    // Emitting must return synchronously without throwing — the caller (e.g. a
    // controller firing this off after a DB write) is never blocked or rejected
    // by a listener's failure.
    expect(() => eventBus.emit(event, { ok: true })).not.toThrow();

    // Give the rejected promise a chance to be (mis)handled, then confirm the
    // process — and the HTTP server it's running — is still up.
    await new Promise((resolve) => setImmediate(resolve));

    await request(ctx.app.getHttpServer()).get('/health').expect(200);
  });
});
