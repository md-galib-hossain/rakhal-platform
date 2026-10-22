import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email").max(254),
  password: z.string().min(1, "Enter your password").max(256),
  /** Empty on a first-ever sign-in (2FA not set up yet). */
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code")
    .or(z.literal(""))
    .optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type CodeInput = z.infer<typeof codeSchema>;

/** Mirrors the backend policy (admin-password-policy.ts) for instant feedback; the server is the authority. */
export const newPasswordRules = z
  .string()
  .min(12, "At least 12 characters")
  .max(128, "At most 128 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/\d/, "Add a digit")
  .regex(/^\S+$/, "No spaces");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword: newPasswordRules,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Must differ from the current password",
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
