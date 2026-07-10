import { z } from "zod";

/** Mirrors the backend's LoginDto (verified live against Swagger, RFE-003). */
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Mirrors the backend's RegisterDto (`src/modules/auth/presentation/dto/register.dto.ts`,
 * verified live RFE-006): email + name + password only. The PRD's phone/OTP registration
 * flow (§5.2) is not implemented server-side — this backend is email+password with a
 * verify-email token link, matching the gap RFE-003 already flagged.
 */
export const registerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** Mirrors ForgotPasswordDto. */
export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** Mirrors ResetPasswordDto (`token` is read from the URL, not user-typed). */
export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
