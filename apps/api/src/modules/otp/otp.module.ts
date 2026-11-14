import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { env } from 'src/core/config/env';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { OtpService } from './application/services/otp.service';
import { EmailOtpChannel } from './application/channels/email-otp.channel';
import { OTP_DELIVERY_CHANNEL } from './application/ports/otp-delivery-channel.port';
import { OtpController } from './presentation/controllers/otp.controller';

/**
 * OTP / account verification (RAKHAL-215/216). CacheModule + PrismaModule are
 * `@Global`. Imports AuthModule for the `JwtAuthGuard`/`SessionGuard` on the
 * controller and EmailModule for the live email channel. The active delivery
 * channel is config-selected at `OTP_DELIVERY_CHANNEL` — `email` today; an
 * `SmsOtpChannel` binds here once MimSMS creds land (RAKHAL-215), no service change.
 */
@Module({
  imports: [LoggerModule, AuthModule, EmailModule],
  controllers: [OtpController],
  providers: [
    OtpService,
    EmailOtpChannel,
    {
      provide: OTP_DELIVERY_CHANNEL,
      // `OTP_CHANNEL` selects the adapter. Only email is wired today; if `sms`
      // is configured before its adapter exists, fall back to email (fail-safe).
      useFactory: (emailChannel: EmailOtpChannel) => {
        if (env.OTP_CHANNEL === 'sms') {
          // SmsOtpChannel not built yet (RAKHAL-215) — keep OTP working via email.
        }
        return emailChannel;
      },
      inject: [EmailOtpChannel],
    },
  ],
  exports: [OtpService],
})
export class OtpModule {}
