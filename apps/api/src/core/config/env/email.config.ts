import { registerAs } from '@nestjs/config';
import { env } from './env';

export const emailConfig = registerAs('email', () => ({
  provider: env.EMAIL_PROVIDER,
  from: env.EMAIL_FROM,
  verificationBaseUrl: env.EMAIL_VERIFICATION_BASE_URL,
  verificationTokenTtlMinutes: env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES,
  resendApiKey: env.RESEND_API_KEY,
}));
