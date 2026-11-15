import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ApiError,
  NetworkError,
  createApiClient,
  createMemoryTokenStore,
  type StoredSession,
} from "../src/index.ts";

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
type Result = { status?: number; json?: unknown } | "network";
type Handler = (call: Call) => Result | Promise<Result>;

const user = { id: "u1", email: "a@b.test", name: "A", isEmailVerified: true };
const ok = (data: unknown) => ({ status: 200, json: { success: true, data } });
const fail = (status: number, message = "nope") => ({ status, json: { success: false, message } });
const auth = (n: number, farmId = "farm-1") =>
  ok({ accessToken: `access-${n}`, refreshToken: `refresh-${n}`, sessionId: "s1", user, farmId, needsFarm: farmId === "" });

function setup(handler: Handler, stored: StoredSession | null = { refreshToken: "refresh-0", farmId: "farm-1" }) {
  const calls: Call[] = [];
  const store = createMemoryTokenStore(stored);
  let expired = 0;
  const fetchImpl = (async (input: string, init: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: String(init.method),
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const result = await handler(call);
    if (result === "network") throw new TypeError("Network request failed");
    return new Response(JSON.stringify(result.json ?? null), {
      status: result.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  const client = createApiClient({
    baseUrl: "https://api.test/api/v1/",
    store,
    fetch: fetchImpl,
    deviceName: "jest-phone",
    onSessionExpired: () => {
      expired += 1;
    },
  });
  return { client, calls, store, expired: () => expired };
}

test("login sends identifier, X-Client and device name, stores the rotated token, keeps the access token in memory", async () => {
  const { client, calls, store } = setup(() => auth(1), null);
  const info = await client.login({ identifier: "rahim", password: "pw-123456" });

  assert.equal(info.farmId, "farm-1");
  assert.deepEqual(calls[0]?.body, { identifier: "rahim", password: "pw-123456" });
  assert.equal(calls[0]?.url, "https://api.test/api/v1/auth/login");
  assert.equal(calls[0]?.headers["X-Client"], "mobile");
  assert.equal(calls[0]?.headers["X-Device-Name"], "jest-phone");
  assert.equal(calls[0]?.headers.Authorization, undefined);
  assert.deepEqual(store.peek(), { refreshToken: "refresh-1", farmId: "farm-1" });
  assert.equal(JSON.stringify(store.peek()).includes("access-1"), false, "access token must not be persisted");
});

test("login surfaces a multi-farm account's farm list and needsFarm", async () => {
  const farms = [
    { id: "f1", name: "One", slug: "one", role: "OWNER" },
    { id: "f2", name: "Two", slug: "two", role: "WORKER" },
  ];
  const { client, store } = setup(
    () => ok({ accessToken: "a", refreshToken: "r", sessionId: "s", user, farmId: "", needsFarm: true, farms }),
    null,
  );
  const info = await client.login({ identifier: "a@b.test", password: "pw-123456" });
  assert.equal(info.needsFarm, true);
  assert.equal(info.farms?.length, 2);
  assert.deepEqual(store.peek(), { refreshToken: "r", farmId: "" });
});

test("a wrong password is an ApiError 401 and leaves nothing stored or expired", async () => {
  const { client, store, expired } = setup(() => fail(401, "Invalid credentials"), null);
  await assert.rejects(
    client.login({ identifier: "x", password: "y" }),
    (e: unknown) => e instanceof ApiError && e.status === 401,
  );
  assert.equal(store.peek(), null);
  assert.equal(expired(), 0);
});

test("cold start: restore makes no network call; the first request refreshes lazily then succeeds", async () => {
  const { client, calls } = setup((call) => (call.url.endsWith("/auth/refresh") ? auth(1) : ok({ hello: "world" })));
  const restored = await client.restore();
  assert.deepEqual(restored, { signedIn: true, farmId: "farm-1" });
  assert.equal(calls.length, 0, "restore() must not touch the network");

  const result = await client.get<{ hello: string }>("/cattle");
  assert.equal(result.data.hello, "world");
  assert.equal(calls[0]?.url.endsWith("/auth/refresh"), true);
  assert.deepEqual(calls[0]?.body, { farmId: "farm-1", refreshToken: "refresh-0" });
  assert.equal(calls[1]?.headers.Authorization, "Bearer access-1");
});

test("restore with an empty store is signed out", async () => {
  const { client } = setup(() => ok({}), null);
  assert.deepEqual(await client.restore(), { signedIn: false, farmId: "" });
});

test("10 parallel 401s cause exactly one refresh, and every call is retried once with the new token", async () => {
  let refreshes = 0;
  const { client, calls } = setup((call) => {
    if (call.url.endsWith("/auth/login")) return auth(1);
    if (call.url.endsWith("/auth/refresh")) {
      refreshes += 1;
      return auth(2);
    }
    return call.headers.Authorization === "Bearer access-2" ? ok({ n: 1 }) : fail(401, "expired");
  }, null);
  await client.login({ identifier: "a@b.test", password: "pw-123456" });

  const results = await Promise.all(Array.from({ length: 10 }, () => client.get("/tasks")));

  assert.equal(results.length, 10);
  assert.equal(refreshes, 1);
  const taskCalls = calls.filter((c) => c.url.endsWith("/tasks"));
  assert.equal(taskCalls.length, 20, "each call: one 401, one retry");
});

test("refresh sends the previous refresh token and stores the rotated one", async () => {
  const { client, calls, store } = setup(
    (call) => {
      if (call.url.endsWith("/auth/refresh")) return auth(5);
      return call.headers.Authorization === "Bearer access-5" ? ok({}) : fail(401);
    },
    { refreshToken: "refresh-4", farmId: "farm-1" },
  );
  await client.restore();
  await client.get("/me");
  assert.deepEqual(calls.find((c) => c.url.endsWith("/auth/refresh"))?.body, {
    farmId: "farm-1",
    refreshToken: "refresh-4",
  });
  assert.equal(store.peek()?.refreshToken, "refresh-5");
});

test("a 401 from the refresh ends the session: store cleared, onSessionExpired fired, caller sees ApiError 401", async () => {
  const { client, store, expired } = setup((call) =>
    call.url.endsWith("/auth/refresh") ? fail(401, "Invalid refresh token") : fail(401),
  );
  await client.restore();
  await assert.rejects(client.get("/tasks"), (e: unknown) => e instanceof ApiError && e.status === 401);
  assert.equal(store.peek(), null);
  assert.equal(expired(), 1);
});

test("a network failure during refresh keeps the session (offline is not logged out)", async () => {
  const { client, store, expired } = setup((call) => (call.url.endsWith("/auth/refresh") ? "network" : ok({})));
  await client.restore();
  await assert.rejects(client.get("/tasks"), (e: unknown) => e instanceof NetworkError);
  assert.deepEqual(store.peek(), { refreshToken: "refresh-0", farmId: "farm-1" });
  assert.equal(expired(), 0);
});

test("a 5xx during refresh keeps the session", async () => {
  const { client, store, expired } = setup((call) => (call.url.endsWith("/auth/refresh") ? fail(503, "down") : ok({})));
  await client.restore();
  await assert.rejects(client.get("/tasks"), (e: unknown) => e instanceof ApiError && e.status === 503);
  assert.equal(store.peek()?.refreshToken, "refresh-0");
  assert.equal(expired(), 0);
});

test("a request that still 401s after the retry is surfaced, not looped", async () => {
  let taskCalls = 0;
  const { client } = setup((call) => {
    if (call.url.endsWith("/auth/refresh")) return auth(1);
    taskCalls += 1;
    return fail(401);
  });
  await client.restore();
  await assert.rejects(client.get("/tasks"), (e: unknown) => e instanceof ApiError && e.status === 401);
  assert.equal(taskCalls, 2);
});

test("switchFarm refreshes with the new farm id and persists it; later bodies carry no farmId", async () => {
  const { client, calls, store } = setup((call) => {
    if (call.url.endsWith("/auth/refresh")) return auth(2, "farm-2");
    return ok({});
  });
  await client.restore();
  const info = await client.switchFarm("farm-2");
  assert.equal(info.farmId, "farm-2");
  assert.equal(client.activeFarmId, "farm-2");
  assert.deepEqual(store.peek(), { refreshToken: "refresh-2", farmId: "farm-2" });

  await client.post("/milk/log", { date: "2026-11-15", session: "MORNING", entries: [] });
  const milk = calls.find((c) => c.url.endsWith("/milk/log"));
  assert.equal(JSON.stringify(milk?.body).includes("farmId"), false);
});

test("switching to a farm the user is not in is rejected by the server (401) and ends the session", async () => {
  const { client, expired } = setup((call) =>
    call.url.endsWith("/auth/refresh") ? fail(401, "Not a member of this farm") : ok({}),
  );
  await client.restore();
  await assert.rejects(client.switchFarm("farm-x"), (e: unknown) => e instanceof ApiError && e.status === 401);
  assert.equal(expired(), 1);
});

test("logout calls the server with the bearer token and clears local state", async () => {
  const { client, calls, store } = setup(() => auth(1), null);
  await client.login({ identifier: "a@b.test", password: "pw-123456" });
  await client.logout();
  const logout = calls.find((c) => c.url.endsWith("/auth/logout"));
  assert.equal(logout?.headers.Authorization, "Bearer access-1");
  assert.equal(store.peek(), null);
  assert.equal(client.activeFarmId, "");
});

test("logout still clears local state when offline", async () => {
  const { client, store } = setup((call) => (call.url.endsWith("/auth/logout") ? "network" : auth(1)), null);
  await client.login({ identifier: "a@b.test", password: "pw-123456" });
  await client.logout();
  assert.equal(store.peek(), null);
});

test("query params are encoded and null/undefined dropped; a non-envelope success is an ApiError", async () => {
  const { client, calls } = setup(
    (call) => (call.url.includes("/bad") ? { status: 200, json: { nope: true } } : ok([])),
    null,
  );
  await client.get("/cattle", { auth: false, query: { search: "গরু 1", limit: 20, cursor: undefined, flag: null } });
  assert.equal(calls[0]?.url, `https://api.test/api/v1/cattle?search=${encodeURIComponent("গরু 1")}&limit=20`);
  await assert.rejects(client.get("/bad", { auth: false }), (e: unknown) => e instanceof ApiError && e.status === 200);
});

test("a request timeout becomes a NetworkError", async () => {
  const store = createMemoryTokenStore(null);
  const hang = ((_: string, init: RequestInit) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })) as unknown as typeof fetch;
  const client = createApiClient({ baseUrl: "https://api.test", store, fetch: hang, timeoutMs: 20 });
  await assert.rejects(
    client.get("/health", { auth: false }),
    (e: unknown) => e instanceof NetworkError && /timed out/.test(e.message),
  );
});

test("request headers (Idempotency-Key) are sent, and can never override auth or client headers", async () => {
  const { client, calls } = setup((call) => (call.url.endsWith("/auth/refresh") ? auth(1) : ok({ saved: 1 })));
  await client.post(
    "/milk/log",
    { a: 1 },
    { headers: { "Idempotency-Key": "key-1234567890", Authorization: "Bearer evil", "X-Client": "web" } },
  );
  const sent = calls[calls.length - 1]!;
  assert.equal(sent.headers["Idempotency-Key"], "key-1234567890");
  assert.equal(sent.headers.Authorization, "Bearer access-1");
  assert.equal(sent.headers["X-Client"], "mobile");
});
