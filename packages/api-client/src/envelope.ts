/** Backend success envelope: `{ success, data, meta }` (customer API). */
export interface ApiMeta {
  nextCursor?: string | null;
  hasMore?: boolean;
  [key: string]: unknown;
}

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  success: false;
  code?: string;
  message: string;
  requestId?: string;
}

/** A non-2xx response (or a 2xx whose body is not a success envelope). */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;
  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.message ?? `Request failed (${status})`);
    this.status = status;
    this.body = body;
    this.name = "ApiError";
  }
  get code(): string | undefined {
    return this.body?.code;
  }
  get isAuthError(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
}

/** The request never produced a response (offline, DNS, timeout, abort). Distinct from a server error. */
export class NetworkError extends Error {
  override readonly cause?: unknown;
  constructor(message = "Network request failed", cause?: unknown) {
    super(message);
    this.cause = cause;
    this.name = "NetworkError";
  }
}

export function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return typeof value === "object" && value !== null && (value as { success?: unknown }).success === true && "data" in value;
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null && (value as { success?: unknown }).success === false;
}
