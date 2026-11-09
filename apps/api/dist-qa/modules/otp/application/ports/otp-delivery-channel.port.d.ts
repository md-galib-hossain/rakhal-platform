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
export interface OtpDeliveryChannel {
    readonly channel: 'email' | 'sms';
    send(request: OtpDeliveryRequest): Promise<void>;
}
export declare const OTP_DELIVERY_CHANNEL: unique symbol;
