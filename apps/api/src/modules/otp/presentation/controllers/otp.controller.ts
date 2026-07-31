import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserId, ThrottleAuth } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { OtpPurpose } from '@prisma/client';
import { OtpService } from '../../application/services/otp.service';
import { VerifyOtpDto } from '../dto/verify-otp.dto';

/**
 * Account verification OTP (RAKHAL-216). `/api/v1/auth/otp`. The signed-in user
 * verifies their own account — no farm context needed, so just
 * `JwtAuthGuard + SessionGuard`. Delivered by email today (SMS when creds land,
 * RAKHAL-215). Rate-limited on top of the service's own resend cooldown.
 */
@ApiTags('Auth — OTP')
@ApiBearerAuth()
@Controller('auth/otp')
@UseGuards(JwtAuthGuard, SessionGuard)
export class OtpController {
  constructor(private readonly otp: OtpService) {}

  @Post('request')
  @UseGuards(ThrottlerGuard)
  @ThrottleAuth()
  request(@CurrentUserId() userId: string) {
    return this.otp.request(userId, OtpPurpose.ACCOUNT_VERIFICATION);
  }

  @Post('verify')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async verify(@CurrentUserId() userId: string, @Body() dto: VerifyOtpDto) {
    await this.otp.verify(userId, OtpPurpose.ACCOUNT_VERIFICATION, dto.code);
    return { verified: true };
  }
}
