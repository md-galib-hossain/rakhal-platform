import { OtpPurpose } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import type { OtpDeliveryChannel } from '../ports/otp-delivery-channel.port';
export interface OtpRequestResult {
    sent: true;
    channel: 'email' | 'sms';
    expires_in_seconds: number;
    code?: string;
}
export declare class OtpService {
    private readonly prisma;
    private readonly channel;
    private readonly log;
    private readonly ttl;
    private readonly maxAttempts;
    private readonly cooldown;
    constructor(prisma: PrismaService, channel: OtpDeliveryChannel, logger: LoggerService);
    private hash;
    request(userId: string, purpose: OtpPurpose): Promise<OtpRequestResult>;
    verify(userId: string, purpose: OtpPurpose, code: string): Promise<void>;
}
