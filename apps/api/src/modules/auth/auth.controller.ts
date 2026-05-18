import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { authConfig } from 'src/core/config/env';
import {
  getClearRefreshCookieOptions,
  getRefreshCookieOptions,
} from 'src/core/security/auth-cookie-options';
import { AuthService } from './application/auth.service';
import { CsrfService } from './application/csrf.service';
import type { AuthenticatedHttpRequest } from './domain/authenticated-http-request.type';
import { AuthenticatedRequestContext } from './domain/authenticated-request-context.type';
import { CsrfGuard } from './guards/csrf.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SessionGuard } from './guards/session.guard';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly csrfService: CsrfService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);

    return {
      user: result.user,
    };
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ login: { ttl: 60_000, limit: 5 } })
  async login(
    @Body() dto: LoginDto,
    @Req() request: AuthenticatedHttpRequest,
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

  @Get('csrf')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  csrf(
    @Req() request: AuthenticatedHttpRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    return {
      csrfToken: this.csrfService.generateToken(request, response),
    };
  }

  @Post('refresh')
  @UseGuards(ThrottlerGuard, CsrfGuard)
  @Throttle({ refresh: { ttl: 60_000, limit: 10 } })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: AuthenticatedHttpRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.getRefreshTokenFromRequest(request);

    try {
      const result = await this.authService.refresh(dto, refreshToken);

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
    } catch (error) {
      response.clearCookie(
        this.config.refreshCookie.name,
        getClearRefreshCookieOptions(this.config),
      );
      throw error;
    }
  }

  @Post('logout')
  @UseGuards(ThrottlerGuard, CsrfGuard, JwtAuthGuard, SessionGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  logout(
    @Body() dto: LogoutDto,
    @Req() request: AuthenticatedHttpRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const auth = this.getAuthContext(request);

    if (dto.sessionId && dto.sessionId !== auth.session.id) {
      throw new UnauthorizedException('Session not found');
    }

    response.clearCookie(
      this.config.refreshCookie.name,
      getClearRefreshCookieOptions(this.config),
    );

    return this.authService.logoutCurrentSession(
      auth.user.sub,
      auth.session.id,
    );
  }

  @Post('logout-all')
  @UseGuards(ThrottlerGuard, CsrfGuard, JwtAuthGuard, SessionGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  logoutAll(
    @Req() request: AuthenticatedHttpRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const auth = this.getAuthContext(request);

    response.clearCookie(
      this.config.refreshCookie.name,
      getClearRefreshCookieOptions(this.config),
    );

    return this.authService.logoutAllSessions(auth.user.sub);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard, SessionGuard)
  sessions(@Req() request: AuthenticatedHttpRequest) {
    const auth = this.getAuthContext(request);
    return this.authService.listSessions(auth.user.sub);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, SessionGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  revokeSession(
    @Param('sessionId') sessionId: string,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const auth = this.getAuthContext(request);

    return this.authService.revokeSessionForCurrentUser(
      auth.user.sub,
      sessionId,
    );
  }

  @Get('me')
  @UseGuards(ThrottlerGuard, JwtAuthGuard, SessionGuard)
  me(@Req() request: AuthenticatedHttpRequest) {
    const auth = this.getAuthContext(request);
    return this.authService.me(auth.user.sub);
  }

  private getRefreshTokenFromRequest(
    request: AuthenticatedHttpRequest,
  ): string | undefined {
    const cookies = request.cookies as
      | Record<string, string | undefined>
      | undefined;

    return cookies?.[this.config.refreshCookie.name];
  }

  private getAuthContext(
    request: AuthenticatedHttpRequest,
  ): AuthenticatedRequestContext {
    const authRequest = request as { auth?: AuthenticatedRequestContext };

    if (!authRequest.auth) {
      throw new UnauthorizedException('Unauthorized');
    }

    const auth = authRequest.auth;
    return auth;
  }
}
