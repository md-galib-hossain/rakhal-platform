import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ThrottleAuth } from 'src/common/decorators';
import { authConfig } from 'src/core/config/env';
import {
  getClearRefreshCookieOptions,
  getRefreshCookieOptions,
} from 'src/core/security/auth-cookie-options';
import { AuthService } from '../../application/services/auth.service';
import { CsrfService } from '../../application/services/csrf.service';
import type { AuthenticatedHttpRequest } from '../../domain/authenticated-http-request.type';
import { AuthenticatedRequestContext } from '../../domain/authenticated-request-context.type';
import { CsrfGuard } from '../guards/csrf.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { SessionGuard } from '../guards/session.guard';
import { LoginDto } from '../dto/login.dto';
import { LogoutDto } from '../dto/logout.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UpdateLanguageDto } from '../dto/update-language.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Auth (§2). `/api/v1/auth`. Mostly public (login/register/refresh use a
 * cookie, not a bearer token); routes needing a signed-in session are
 * individually marked `@ApiBearerAuth()` below. */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly csrfService: CsrfService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  @Post('register')
  @ThrottleAuth()
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);

    return {
      user: result.user,
    };
  }

  @Post('login')
  @ThrottleAuth()
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

    // Native clients (`X-Client: mobile`) have no cookie jar: hand the refresh
    // token back in the body and set no cookie. Browsers are unchanged.
    const nativeClient = this.isNativeClient(request);
    if (!nativeClient) {
      response.cookie(
        this.config.refreshCookie.name,
        result.refreshToken,
        getRefreshCookieOptions(this.config),
      );
    }

    return {
      accessToken: result.accessToken,
      ...(nativeClient ? { refreshToken: result.refreshToken } : {}),
      sessionId: result.sessionId,
      user: result.user,
      farmId: result.farmId,
      needsFarm: result.needsFarm,
      farms: result.farms,
    };
  }

  @Post('verify-email')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmailToken(dto.token);
  }

  @Post('forgot-password')
  @ThrottleAuth()
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @ThrottleAuth()
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @UseGuards(CsrfGuard, JwtAuthGuard, SessionGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const auth = this.getAuthContext(request);

    return this.authService.changePassword(auth.user.sub, dto);
  }

  @Get('csrf')
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
  @UseGuards(CsrfGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: AuthenticatedHttpRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieToken = this.getRefreshTokenFromRequest(request);
    // The cookie always wins (browsers). The body token is honoured only when
    // no cookie was sent, i.e. a native client; it is then rotated in the body.
    const bodyToken = cookieToken ? undefined : dto.refreshToken;
    const refreshToken = cookieToken ?? bodyToken;

    try {
      const result = await this.authService.refresh(dto, refreshToken);

      if (!bodyToken) {
        response.cookie(
          this.config.refreshCookie.name,
          result.refreshToken,
          getRefreshCookieOptions(this.config),
        );
      }

      return {
        accessToken: result.accessToken,
        ...(bodyToken ? { refreshToken: result.refreshToken } : {}),
        sessionId: result.sessionId,
        user: result.user,
        farmId: result.farmId,
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
  @ApiBearerAuth()
  @UseGuards(CsrfGuard, JwtAuthGuard, SessionGuard)
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
  @ApiBearerAuth()
  @UseGuards(CsrfGuard, JwtAuthGuard, SessionGuard)
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SessionGuard)
  sessions(@Req() request: AuthenticatedHttpRequest) {
    const auth = this.getAuthContext(request);
    return this.authService.listSessions(auth.user.sub);
  }

  @Delete('sessions/:sessionId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SessionGuard)
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SessionGuard)
  me(@Req() request: AuthenticatedHttpRequest) {
    const auth = this.getAuthContext(request);
    return this.authService.me(
      auth.user.sub,
      auth.user.farmId,
      auth.user.permissionsVersion,
    );
  }

  @Patch('me/language')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SessionGuard)
  updateLanguage(
    @Body() dto: UpdateLanguageDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    const auth = this.getAuthContext(request);
    return this.authService.updateLanguage(
      auth.user.sub,
      dto.preferredLanguage,
    );
  }

  /** `X-Client: mobile` opts a native client into body-delivered refresh tokens. */
  private isNativeClient(request: AuthenticatedHttpRequest): boolean {
    const header = request.headers['x-client'];
    const value = Array.isArray(header) ? header[0] : header;
    return typeof value === 'string' && value.toLowerCase() === 'mobile';
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
