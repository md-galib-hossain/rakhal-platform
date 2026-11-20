/**
 * Auth-aware HTTP client for native clients (mobile WP5c). Framework-free: no React, no Expo, no globals beyond
 * an injectable `fetch`. Mirrors the contract added in WP5a/WP5b:
 *
 * - login and refresh send `X-Client: mobile`; the refresh token travels in the response/request BODY (no cookies, no CSRF);
 * - the access token lives only in memory; the refresh token (+ active farm id) lives in the injected `TokenStore`
 *   (SecureStore on a phone) and is rotated on every refresh;
 * - a 401 on an authenticated call triggers exactly one refresh (single-flight across concurrent calls) and one retry;
 * - a 401 from the refresh itself means the session is gone (revoked, expired, or reuse detected): the store is cleared and
 *   `onSessionExpired` fires. A network failure during refresh does NOT end the session (the phone may simply be offline);
 * - requests never carry a `farmId` in the body: the farm is part of the token, switched with `switchFarm`.
 */
import {
  ApiError,
  NetworkError,
  isApiEnvelope,
  isApiErrorBody,
  type ApiEnvelope,
  type ApiMeta,
} from "./envelope.ts";

/** What survives an app restart. Never contains the access token. */
export interface StoredSession {
  refreshToken: string;
  /** Active farm of the session; `""` means "signed in, no farm picked yet". */
  farmId: string;
}

export interface TokenStore {
  load(): Promise<StoredSession | null>;
  save(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isEmailVerified: boolean;
}

export interface FarmSummary {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface SessionInfo {
  user: AuthUser;
  sessionId: string;
  farmId: string;
  needsFarm: boolean;
  /** Present on login when the account has two or more farms and no `farmId` was sent. */
  farms?: FarmSummary[];
}

export interface LoginParams {
  /** Email or username. */
  identifier: string;
  password: string;
  /** Optional: omit to let the server auto-scope (0 farms: needsFarm, 1: scoped, 2+: `farms` returned). */
  farmId?: string;
}

export interface ApiClientOptions {
  /** Origin plus API prefix, e.g. `https://api.example.com/api/v1`. No trailing slash needed. */
  baseUrl: string;
  store: TokenStore;
  fetch?: typeof fetch;
  /** Sent as `X-Device-Name` so the session list is readable. */
  deviceName?: string;
  /** Per-request timeout (default 20 s: poor field connectivity, but never hang the UI forever). */
  timeoutMs?: number;
  /** Called once when the session can no longer be refreshed (401 from refresh). The store is already cleared. */
  onSessionExpired?: () => void;
}

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /**
   * Extra request headers, e.g. `Idempotency-Key` for a write that may be retried (ADR-006). They are added first, so
   * `Authorization`, `Content-Type`, `Accept`, `X-Client` and `X-Device-Name` always win.
   */
  headers?: Record<string, string>;
  /** Default true. Set false for public routes. */
  auth?: boolean;
  signal?: AbortSignal;
}

export interface ApiResult<T> {
  data: T;
  meta?: ApiMeta;
}

type AuthPayload = {
  accessToken: string;
  refreshToken?: string;
  sessionId: string;
  user: AuthUser;
  farmId: string;
  needsFarm?: boolean;
  farms?: FarmSummary[];
};

const DEFAULT_TIMEOUT_MS = 20_000;

export class ApiClient {
  private readonly baseUrl: string;
  private readonly store: TokenStore;
  private readonly fetchImpl: typeof fetch;
  private readonly deviceName: string | undefined;
  private readonly timeoutMs: number;
  private readonly onSessionExpired: (() => void) | undefined;

  private accessToken: string | null = null;
  private farmId = "";
  /** Bumped every time a new access token is installed, so a late 401 can tell "stale token" from "bad session". */
  private tokenVersion = 0;
  private refreshInFlight: Promise<SessionInfo> | null = null;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.store = options.store;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.deviceName = options.deviceName;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.onSessionExpired = options.onSessionExpired;
  }

  /** Active farm of the in-memory session (`""` when none picked). */
  get activeFarmId(): string {
    return this.farmId;
  }

  /**
   * Cold start. Reads the store only: NO network call, so the app shell can render offline. The first authenticated
   * request (or an explicit `refresh`) obtains the access token lazily.
   */
  async restore(): Promise<{ signedIn: boolean; farmId: string }> {
    const stored = await this.store.load();
    if (!stored) {
      this.accessToken = null;
      this.farmId = "";
      return { signedIn: false, farmId: "" };
    }
    this.farmId = stored.farmId;
    return { signedIn: true, farmId: stored.farmId };
  }

  async login(params: LoginParams): Promise<SessionInfo> {
    const body: Record<string, string> = {
      identifier: params.identifier,
      password: params.password,
    };
    if (params.farmId !== undefined) body.farmId = params.farmId;

    const { data } = await this.send<AuthPayload>("POST", "/auth/login", {
      body,
      auth: false,
    });
    return this.adoptSession(data, params.farmId);
  }

  /** Mint a fresh access token (rotating the refresh token), optionally switching farm. Single-flight. */
  refresh(farmId?: string): Promise<SessionInfo> {
    if (this.refreshInFlight) return this.refreshInFlight;

    const run = this.doRefresh(farmId ?? this.farmId).finally(() => {
      this.refreshInFlight = null;
    });
    this.refreshInFlight = run;
    return run;
  }

  /** Switch the active farm. The server verifies membership; the refresh token is rotated as usual. */
  switchFarm(farmId: string): Promise<SessionInfo> {
    // A refresh already in flight targets the old farm; let it finish, then switch.
    if (this.refreshInFlight) {
      return this.refreshInFlight.then(() => this.refresh(farmId));
    }
    return this.refresh(farmId);
  }

  /** Best-effort server logout, then always clear local state (a phone with no signal must still be able to sign out). */
  async logout(): Promise<void> {
    try {
      if (this.accessToken) {
        await this.send("POST", "/auth/logout", {
          body: {},
          auth: true,
          skipRefresh: true,
        });
      }
    } catch {
      // Offline or already expired: the local session is removed below either way.
    }
    await this.clearLocal();
  }

  async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    options: RequestOptions = {},
  ): Promise<ApiResult<T>> {
    return this.send<T>(method, path, options);
  }

  get<T>(path: string, options?: Omit<RequestOptions, "body">): Promise<ApiResult<T>> {
    return this.send<T>("GET", path, options ?? {});
  }

  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">): Promise<ApiResult<T>> {
    return this.send<T>("POST", path, { ...options, body });
  }

  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">): Promise<ApiResult<T>> {
    return this.send<T>("PATCH", path, { ...options, body });
  }

  delete<T>(path: string, options?: RequestOptions): Promise<ApiResult<T>> {
    return this.send<T>("DELETE", path, options ?? {});
  }

  // ---------------------------------------------------------------------------------------------------------------

  private async doRefresh(farmId: string): Promise<SessionInfo> {
    const stored = await this.store.load();
    if (!stored) {
      await this.expireSession();
      throw new ApiError(401, {
        success: false,
        message: "No stored session",
        code: "NO_SESSION",
      });
    }

    let payload: AuthPayload;
    try {
      const result = await this.send<AuthPayload>("POST", "/auth/refresh", {
        body: { farmId, refreshToken: stored.refreshToken },
        auth: false,
      });
      payload = result.data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Revoked, expired, or token reuse detected: the session is over.
        await this.expireSession();
      }
      // Network errors and 5xx keep the session so the next attempt can succeed.
      throw error;
    }
    return this.adoptSession(payload, farmId);
  }

  private async adoptSession(payload: AuthPayload, requestedFarmId?: string): Promise<SessionInfo> {
    const farmId = payload.farmId ?? requestedFarmId ?? "";
    // Persist the rotated refresh token BEFORE exposing the new access token: if the app dies in between, the next
    // start still holds a valid (current) refresh token instead of one the server already rotated away.
    if (payload.refreshToken) {
      await this.store.save({ refreshToken: payload.refreshToken, farmId });
    }
    this.accessToken = payload.accessToken;
    this.farmId = farmId;
    this.tokenVersion += 1;
    return {
      user: payload.user,
      sessionId: payload.sessionId,
      farmId,
      needsFarm: payload.needsFarm ?? farmId === "",
      farms: payload.farms,
    };
  }

  private async expireSession(): Promise<void> {
    await this.clearLocal();
    this.onSessionExpired?.();
  }

  private async clearLocal(): Promise<void> {
    this.accessToken = null;
    this.farmId = "";
    this.tokenVersion += 1;
    await this.store.clear();
  }

  private async send<T>(
    method: string,
    path: string,
    options: RequestOptions & { skipRefresh?: boolean },
  ): Promise<ApiResult<T>> {
    const wantsAuth = options.auth !== false;

    if (wantsAuth && !this.accessToken && !options.skipRefresh) {
      // Cold start (restore() made no network call) or after a failed refresh: get a token first.
      await this.refresh();
    }

    const versionUsed = this.tokenVersion;
    try {
      return await this.attempt<T>(method, path, options, wantsAuth);
    } catch (error) {
      const isUnauthorized = error instanceof ApiError && error.status === 401;
      if (!isUnauthorized || !wantsAuth || options.skipRefresh) throw error;

      // If another caller already installed a newer token while this request was in flight, just retry with it.
      if (this.tokenVersion === versionUsed) {
        await this.refresh();
      }
      return this.attempt<T>(method, path, options, wantsAuth);
    }
  }

  private async attempt<T>(
    method: string,
    path: string,
    options: RequestOptions,
    wantsAuth: boolean,
  ): Promise<ApiResult<T>> {
    const headers: Record<string, string> = {
      ...options.headers,
      Accept: "application/json",
      "X-Client": "mobile",
    };
    if (this.deviceName) headers["X-Device-Name"] = this.deviceName;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (wantsAuth && this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onCallerAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onCallerAbort);

    let response: Response;
    try {
      response = await this.fetchImpl(this.buildUrl(path, options.query), {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch (error) {
      throw new NetworkError(
        controller.signal.aborted && !options.signal?.aborted ? "Request timed out" : "Network request failed",
        error,
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onCallerAbort);
    }

    const json: unknown = await response.json().catch(() => null);
    if (response.ok && isApiEnvelope(json)) {
      return { data: json.data as T, meta: (json as ApiEnvelope<T>).meta };
    }
    throw new ApiError(response.status, isApiErrorBody(json) ? json : null);
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    if (!query) return url;
    const params: string[] = [];
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined) continue;
      params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
    return params.length ? `${url}?${params.join("&")}` : url;
  }
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}

/** In-memory `TokenStore` for tests and tooling. Not for production (nothing persists). */
export function createMemoryTokenStore(initial: StoredSession | null = null): TokenStore & {
  peek(): StoredSession | null;
} {
  let current = initial;
  return {
    load: () => Promise.resolve(current),
    save: (session) => {
      current = { ...session };
      return Promise.resolve();
    },
    clear: () => {
      current = null;
      return Promise.resolve();
    },
    peek: () => current,
  };
}
