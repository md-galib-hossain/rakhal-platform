import { registerAs } from '@nestjs/config';
import { env } from './env';

export const emailConfig = registerAs('email', () => ({
  provider: env.EMAIL_PROVIDER,
  from: env.EMAIL_FROM,
  verificationBaseUrl: env.EMAIL_VERIFICATION_BASE_URL,
  passwordResetBaseUrl:
    env.EMAIL_PASSWORD_RESET_BASE_URL ?? env.EMAIL_VERIFICATION_BASE_URL,
  inviteBaseUrl:
    env.EMAIL_INVITE_BASE_URL ??
    `${new URL(env.EMAIL_VERIFICATION_BASE_URL).origin}/invite`,
  verificationTokenTtlMinutes: env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES,
  resendApiKey: env.RESEND_API_KEY,
}));
