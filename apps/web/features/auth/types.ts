export interface FarmOption {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export type LoginResponse =
  | { status: "ok"; user: { id: string; email: string; name: string; isEmailVerified: boolean } }
  | { status: "select-farm"; farms: FarmOption[] }
  | { status: "no-farms" };

/** `POST /auth/register` — no auto-login; the account still needs email verification. */
export interface RegisterResponse {
  user: { id: string; email: string; name: string };
}

/** `POST /auth/verify-email`, `POST /auth/forgot-password`, `POST /auth/reset-password`. */
export interface SuccessResponse {
  success: true;
}
