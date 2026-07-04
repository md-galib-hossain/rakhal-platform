import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { AdminAuthService } from '../../application/services/admin-auth.service';
import { AdminLoginDto } from '../dto/admin-login.dto';

/**
 * Platform-admin auth (RAKHAL-224, PRD §32.5). `admin-api` surface —
 * `POST /admin/auth/login` is the only unguarded admin route (you need a token
 * to reach every other `/admin/*` route). Rate-limited to blunt credential
 * stuffing. Sessions / refresh / 2FA are RAKHAL-225.
 */
@ApiTags('Admin — Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ login: { ttl: 60_000, limit: 5 } })
  login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    return this.adminAuth.login(dto.email, dto.password, req.ip);
  }
}
