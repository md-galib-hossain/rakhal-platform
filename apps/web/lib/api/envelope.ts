import { ApiError } from "./errors";
import type { ApiEnvelope } from "@/types/api";

/** Pure helper shared by the client and server fetchers — no side effects, safe in any bundle. */
export function unwrapEnvelope<T>(envelope: ApiEnvelope<T>, status: number): T {
  if (!envelope.success) {
    throw new ApiError(envelope.code, envelope.message, status, envelope.requestId, envelope.details);
  }
  return envelope.data;
}
