import { OtpPurpose } from '@prisma/client';
import { AppLanguage } from 'src/common/i18n/language';

export interface OtpDeliveryRequest {
  userId: string;
  email: string;
  name: string;
  code: string;
  purpose: OtpPurpose;
  ttlSeconds: number;
  locale: AppLanguage;
}

/**
 * Swappable OTP delivery seam (RAKHAL-215). `EmailOtpChannel` is the live impl;
 * an `SmsOtpChannel` drops in behind this same port + the `OTP_CHANNEL` config
 * once MimSMS credentials are available — no change to `OtpService`.
 */
export interface OtpDeliveryChannel {
  readonly channel: 'email' | 'sms';
  send(request: OtpDeliveryRequest): Promise<void>;
}

/** DI token for the config-selected active OTP channel. */
export const OTP_DELIVERY_CHANNEL = Symbol('OTP_DELIVERY_CHANNEL');
