import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Inject,
  Req,
  Res,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './application/auth.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RevokeSessionDto } from './dto/revoke-session.dto';
import { authConfig } from 'src/core/config/env';
import {
  getRefreshCookieOptions,
  getClearRefreshCookieOptions,
} from 'src/core/security/auth-cookie-options';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);

    return {
      user: result.user,
    };
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.loginWithContext(dto, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      deviceName:
        typeof request.headers['x-device-name'] === 'string'
          ? request.headers['x-device-name']
          : undefined,
    });

    response.cookie(
      this.config.refreshCookie.name,
      result.refreshToken,
      getRefreshCookieOptions(this.config),
    );

    return {
      accessToken: result.accessToken,
      sessionId: result.sessionId,
      user: result.user,
    };
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  logout(
    @Body() dto: LogoutDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.clearCookie(
      this.config.refreshCookie.name,
      getClearRefreshCookieOptions(this.config),
    );

    return this.authService.logout(dto);
  }

  @Post('logout-all')
  logoutAll(@Query('userId') userId: string) {
    return this.authService.logoutAll(userId);
  }

  @Get('sessions')
  sessions(@Query('userId') userId: string) {
    return this.authService.sessions(userId);
  }

  @Delete('sessions/:sessionId')
  revokeSession(@Param('sessionId') sessionId: string) {
    const dto: RevokeSessionDto = { sessionId };
    return this.authService.revokeSession(dto);
  }

  @Get('me')
  me(@Query('userId') userId: string) {
    return this.authService.me(userId);
  }
}
