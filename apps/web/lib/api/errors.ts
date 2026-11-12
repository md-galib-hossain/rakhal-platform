import type { ApiErrorCode } from "@/types/api";

/**
 * Mirrors the backend's real error codes (verified live, see types/api.ts header comment).
 * Central handling per docs/ARCHITECTURE.md §5: 401 → refresh-once→logout (handled by the
 * proxy + client, not here), 403 → toast, VALIDATION_ERROR → form-level message (no field
 * `details` exist on this backend), RATE_LIMITED → backoff notice, 5xx → ErrorState.
 */
export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public status: number,
    public requestId?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isAuthError() {
    return this.status === 401;
  }
  get isForbidden() {
    return this.status === 403;
  }
  get isValidation() {
    return this.status === 400 && this.code === "VALIDATION_ERROR";
  }
  get isRateLimited() {
    return this.status === 429;
  }
  get isServerError() {
    return this.status >= 500;
  }
}

/** Network/parse failures that never reached a real API response (offline, DNS, backend down). */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("Network request failed");
    this.name = "NetworkError";
    this.cause = cause;
  }
}
