import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import { OtpPurpose } from '@prisma/client';
import { env } from 'src/core/config/env';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { OTP_DELIVERY_CHANNEL } from '../ports/otp-delivery-channel.port';
import type { OtpDeliveryChannel } from '../ports/otp-delivery-channel.port';
import type { AppLanguage } from 'src/common/i18n/language';

export interface OtpRequestResult {
  sent: true;
  channel: 'email' | 'sms';
  expires_in_seconds: number;
  /** Non-production only (for testing without an inbox); never set in prod. */
  code?: string;
}

/**
 * OTP engine (RAKHAL-216). Generates a 6-digit code, stores it **hashed** in
 * Postgres (`OtpChallenge` — the same durable-token pattern as email
 * verification / password reset; the Redis cache isn't a reliable store here,
 * RD-028) with a TTL + attempt cap + resend cooldown, and delivers it through
 * the swappable `OTP_DELIVERY_CHANNEL` (email today, SMS later). Verifying sets
 * `User.phoneVerifiedAt` — the anti-fraud gate for 100%-off coupons (CPN-04)
 * and trial abuse (SUP-02).
 */
@Injectable()
export class OtpService {
  private readonly log: LoggerService;
  private readonly ttl = env.OTP_TTL_SECONDS;
  private readonly maxAttempts = env.OTP_MAX_ATTEMPTS;
  private readonly cooldown = env.OTP_RESEND_COOLDOWN_SECONDS;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OTP_DELIVERY_CHANNEL)
    private readonly channel: OtpDeliveryChannel,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(OtpService.name);
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  async request(
    userId: string,
    purpose: OtpPurpose,
  ): Promise<OtpRequestResult> {
    // Resend cooldown — a fresh, unconsumed challenge created within the window.
    const recent = await this.prisma.otpChallenge.findFirst({
      where: {
        userId,
        purpose,
        consumedAt: null,
        createdAt: { gt: new Date(Date.now() - this.cooldown * 1000) },
      },
    });
    if (recent) {
      throw new BadRequestException(
        'Please wait before requesting another code',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, preferredLanguage: true },
    });
    if (!user) throw new BadRequestException('User not found');

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

    // A new request invalidates any prior unconsumed challenge (single active code).
    await this.prisma.$transaction([
      this.prisma.otpChallenge.updateMany({
        where: { userId, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.otpChallenge.create({
        data: {
          userId,
          purpose,
          codeHash: this.hash(code),
          expiresAt: new Date(Date.now() + this.ttl * 1000),
        },
      }),
    ]);

    await this.channel.send({
      userId,
      email: user.email,
      name: user.name,
      code,
      purpose,
      ttlSeconds: this.ttl,
      locale: user.preferredLanguage.toLowerCase() as AppLanguage,
    });
    this.log.info('OTP requested', {
      userId,
      purpose,
      channel: this.channel.channel,
    });

    return {
      sent: true,
      channel: this.channel.channel,
      expires_in_seconds: this.ttl,
      ...(env.NODE_ENV !== 'production' ? { code } : {}),
    };
  }

  async verify(
    userId: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<void> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge || challenge.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired code');
    }
    if (challenge.attempts >= this.maxAttempts) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new BadRequestException('Too many attempts — request a new code');
    }
    if (this.hash(code) !== challenge.codeHash) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid or expired code');
    }

    await this.prisma.$transaction([
      this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { phoneVerifiedAt: new Date() },
      }),
    ]);
    this.log.info('OTP verified — account marked verified', {
      userId,
      purpose,
    });
  }
}
