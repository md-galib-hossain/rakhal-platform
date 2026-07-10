"use client";

import { apiFetch } from "@/lib/api/client";
import { unwrapEnvelope } from "@/lib/api/envelope";
import { NetworkError } from "@/lib/api/errors";
import type { ApiEnvelope } from "@/types/api";
import type { ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput } from "./schemas";
import type { LoginResponse, RegisterResponse, SuccessResponse } from "./types";

/**
 * `login` calls our own BFF route directly (`/api/auth/login`), NOT the generic
 * `/api/backend/[...path]` proxy — it has bespoke cookie-management logic (lib/auth/session.ts)
 * that a pass-through proxy can't do. The other unauthenticated auth endpoints below have no
 * cookies to set, so they go through the generic proxy like any other feature.
 */
export const authApi = {
  async login(input: LoginInput & { farmId?: string }): Promise<LoginResponse> {
    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      });
    } catch (cause) {
      throw new NetworkError(cause);
    }
    const envelope = (await res.json()) as ApiEnvelope<LoginResponse>;
    return unwrapEnvelope(envelope, res.status);
  },

  register(input: RegisterInput): Promise<RegisterResponse> {
    return apiFetch<RegisterResponse>("/auth/register", { method: "POST", body: input });
  },

  verifyEmail(token: string): Promise<SuccessResponse> {
    return apiFetch<SuccessResponse>("/auth/verify-email", { method: "POST", body: { token } });
  },

  forgotPassword(input: ForgotPasswordInput): Promise<SuccessResponse> {
    return apiFetch<SuccessResponse>("/auth/forgot-password", { method: "POST", body: input });
  },

  resetPassword(input: ResetPasswordInput): Promise<SuccessResponse> {
    return apiFetch<SuccessResponse>("/auth/reset-password", { method: "POST", body: input });
  },
};
