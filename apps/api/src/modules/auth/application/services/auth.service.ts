import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { AuditAction, SessionStatus } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { DomainEventBusService } from 'src/common/events/domain-event-bus.service';
import { authConfig } from 'src/core/config/env';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { USER_REGISTERED_EVENT } from 'src/modules/auth/domain/events/user-registered.event';
import {
  LoginInput,
  LogoutInput,
  RefreshTokenInput,
  RegisterInput,
  RevokeSessionInput,
} from '../dto/auth.inputs';
import { LoginContext } from '../../domain/login-context.type';
import { LoginResult } from '../../domain/login-result.type';
import { RegisterResult } from '../../domain/register-result.type';
import { RegisteredUser } from '../../domain/registered-user.type';
import { AuthTokenPayload } from '../../domain/auth-token-payload.type';
import { AuthRepository } from '../../infrastructure/persistence/repositories/auth.repository';
import { PasswordService } from './password.service';
import { PermissionsVersionCacheService } from './permissions-version-cache.service';
import { RefreshTokenService } from './refresh-token.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly log: LoggerService;

  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
    private readonly authRepository: AuthRepository,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly permissionsVersionCache: PermissionsVersionCacheService,
    private readonly tokenService: TokenService,
    private readonly eventBus: DomainEventBusService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(AuthService.name);
  }

  async register(dto: RegisterInput): Promise<RegisterResult> {
    const passwordHash = await this.passwordService.hashPassword(dto.password);

    try {
      const user = await this.authRepository.createUser({
        email: dto.email,
        name: dto.name,
        passwordHash,
      });
      this.eventBus.emit(USER_REGISTERED_EVENT, {
        userId: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.id,
        farmId: null,
      });

      this.log.audit('auth.register', {
        userId: user.id,
        tenantId: user.id,
        farmId: null,
        correlationId: null,
        timestamp: new Date().toISOString(),
        emailDomain: dto.email.split('@')[1] ?? null,
      });

      return {
        user: this.toRegisteredUser(user),
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Email already exists');
      }

      throw error;
    }
  }

  async login(dto: LoginInput): Promise<LoginResult> {
    return this.loginWithContext(dto);
  }

  async refresh(dto: RefreshTokenInput, rawRefreshToken?: string) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const storedToken =
      await this.refreshTokenService.findByRawToken(rawRefreshToken);

    if (!storedToken?.session?.user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const now = new Date();
    const session = storedToken.session;
    const user = session.user;

    if (
      storedToken.isRevoked ||
      storedToken.expiresAt.getTime() <= now.getTime() ||
      session.status !== SessionStatus.ACTIVE ||
      session.expiresAt.getTime() <= now.getTime()
    ) {
      await this.refreshTokenService.markReuse({
        refreshTokenId: storedToken.id,
        tokenFamily: storedToken.tokenFamily,
        sessionId: session.id,
        userId: user.id,
        ipAddress: undefined,
        userAgent: undefined,
        deviceName: session.deviceName ?? undefined,
        farmId: dto.farmId,
      });

      this.log.warn('Refresh token reuse detected', {
        userId: user.id,
        sessionId: session.id,
        tokenFamily: storedToken.tokenFamily,
        farmId: dto.farmId,
      });

      throw new UnauthorizedException('Invalid refresh token');
    }

    const nextRefreshToken = this.refreshTokenService.generateToken();
    const nextRefreshTokenHash =
      this.refreshTokenService.hashToken(nextRefreshToken);
    const nextRefreshTokenExpiresAt = new Date(
      now.getTime() + this.parseDurationToMs(this.config.refreshExpiresIn),
    );

    const rotationResult = await this.refreshTokenService.completeRotation({
      refreshTokenId: storedToken.id,
      tokenFamily: storedToken.tokenFamily,
      tokenHash: nextRefreshTokenHash,
      tokenExpiresAt: nextRefreshTokenExpiresAt,
      parentTokenId: storedToken.id,
      sessionId: session.id,
      userId: user.id,
      farmId: dto.farmId,
      deviceName: session.deviceName ?? undefined,
    });

    const accessToken = await this.tokenService.signAccessToken(
      this.buildAccessTokenPayload({
        userId: user.id,
        sessionId: rotationResult.session.id,
        farmId: dto.farmId,
        permissionsVersion: user.permissionsVersion,
      }),
    );

    await this.permissionsVersionCache.set(user.id, user.permissionsVersion);

    this.log.audit('auth.refresh', {
      userId: user.id,
      sessionId: rotationResult.session.id,
      tokenFamily: storedToken.tokenFamily,
      farmId: dto.farmId,
    });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      sessionId: rotationResult.session.id,
      user: this.toRegisteredUser(user),
    };
  }

  async logoutCurrentSession(userId: string, sessionId: string) {
    const result = await this.sessionService.revokeSessionForUser(
      sessionId,
      userId,
      AuditAction.LOGOUT,
    );

    if (!result) {
      throw new UnauthorizedException('Session not found');
    }

    await this.permissionsVersionCache.invalidate(userId);

    this.log.audit('auth.logout', {
      userId,
      sessionId,
    });

    return {
      success: true,
    };
  }

  async logoutAllSessions(userId: string) {
    const result = await this.sessionService.revokeAllSessionsForUser(userId);

    await this.permissionsVersionCache.invalidate(userId);

    this.log.audit('auth.logout_all', {
      userId,
      revokedSessions: result.revokedSessions,
      revokedRefreshTokens: result.revokedRefreshTokens,
    });

    return {
      success: true,
      ...result,
    };
  }

  async listSessions(userId: string) {
    return this.sessionService.listUserSessions(userId);
  }

  async revokeSessionForCurrentUser(userId: string, sessionId: string) {
    const result = await this.sessionService.revokeSessionForUser(
      sessionId,
      userId,
      AuditAction.SESSION_REVOKED,
    );

    if (!result) {
      throw new UnauthorizedException('Session not found');
    }

    await this.permissionsVersionCache.invalidate(userId);

    this.log.audit('auth.session_revoked', {
      userId,
      sessionId,
      revokedRefreshTokens: result.revokedRefreshTokens,
    });

    return {
      success: true,
      ...result,
    };
  }

  logout(dto: LogoutInput) {
    void dto;
    return {
      success: true,
    };
  }

  logoutAll(userId: string) {
    return this.logoutAllSessions(userId);
  }

  sessions(userId: string) {
    return this.listSessions(userId);
  }

  revokeSession(dto: RevokeSessionInput) {
    void dto;
    return {
      success: true,
    };
  }

  me(userId: string) {
    return this.authRepository.findUserById(userId);
  }

  async verifyEmailToken(token: string) {
    const user = await this.authRepository.verifyEmailToken(token);
    if (!user) {
      this.log.warn('Email verification failed for invalid token', {
        emailId: null,
        userId: null,
        tenantId: null,
        farmId: null,
        correlationId: null,
        timestamp: new Date().toISOString(),
      });
      throw new UnauthorizedException('Invalid verification token');
    }

    this.log.audit('auth.email_verified', {
      emailId: null,
      userId: user.id,
      tenantId: user.id,
      farmId: null,
      correlationId: null,
      timestamp: new Date().toISOString(),
      emailDomain: user.email.split('@')[1] ?? null,
    });

    return { success: true };
  }

  async loginWithContext(
    dto: LoginInput,
    context: LoginContext = {},
  ): Promise<LoginResult> {
    const user = await this.authRepository.findUserByEmail(dto.email);

    if (!user?.passwordHash || user.deletedAt) {
      this.log.warn('Rejected login for invalid credentials', {
        email: dto.email,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isBlocked || this.isLockActive(user.lockedUntil)) {
      await this.authRepository.recordSuspiciousLogin({
        userId: user.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        deviceName: context.deviceName,
        reason: user.isBlocked ? 'blocked-user' : 'account-locked',
      });

      this.log.warn('Rejected login for blocked or locked account', {
        userId: user.id,
        reason: user.isBlocked ? 'blocked-user' : 'account-locked',
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.passwordService.verifyPassword(
      user.passwordHash,
      dto.password,
    );

    if (!isValid) {
      const nextFailedAttempts = user.failedLoginAttempts + 1;
      await this.handleFailedLogin(user.id, nextFailedAttempts, context);
      throw new UnauthorizedException('Invalid credentials');
    }

    const refreshToken = this.refreshTokenService.generateToken();
    const sessionExpiresAt = this.parseExpiresInToDate(
      this.config.refreshExpiresIn,
    );
    const refreshTokenExpiresAt = sessionExpiresAt;
    const tokenFamily = randomBytes(16).toString('hex');
    const refreshTokenHash = this.refreshTokenService.hashToken(refreshToken);

    const { session } = await this.authRepository.completeSuccessfulLogin({
      userId: user.id,
      sessionExpiresAt,
      refreshTokenHash,
      tokenFamily,
      refreshTokenExpiresAt,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceName: context.deviceName,
    });

    const accessToken = await this.tokenService.signAccessToken(
      this.buildAccessTokenPayload({
        userId: user.id,
        sessionId: session.id,
        farmId: dto.farmId,
        permissionsVersion: user.permissionsVersion,
      }),
    );

    await this.permissionsVersionCache.set(user.id, user.permissionsVersion);

    this.log.audit('auth.login', {
      userId: user.id,
      sessionId: session.id,
      farmId: dto.farmId,
      deviceName: context.deviceName ?? null,
    });

    return {
      accessToken,
      refreshToken,
      sessionId: session.id,
      user: this.toRegisteredUser(user),
    };
  }

  private async handleFailedLogin(
    userId: string,
    failedLoginAttempts: number,
    context: LoginContext,
  ): Promise<void> {
    const lockedUntil =
      failedLoginAttempts >= this.config.lockout.maxFailedAttempts
        ? new Date(Date.now() + this.config.lockout.durationSeconds * 1000)
        : null;

    await this.authRepository.recordFailedLoginAttempt({
      userId,
      failedLoginAttempts: lockedUntil !== null ? 0 : failedLoginAttempts,
      lockedUntil,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceName: context.deviceName,
      reason: 'invalid-password',
    });

    this.log.warn('Rejected login for invalid password', {
      userId,
      failedLoginAttempts,
      lockedUntil: lockedUntil?.toISOString() ?? null,
    });
  }

  private buildAccessTokenPayload(data: {
    userId: string;
    sessionId: string;
    farmId: string;
    permissionsVersion: number;
  }): AuthTokenPayload {
    return {
      sub: data.userId,
      sessionId: data.sessionId,
      farmId: data.farmId,
      permissionsVersion: data.permissionsVersion,
    };
  }

  private isLockActive(lockedUntil: Date | null) {
    return Boolean(lockedUntil && lockedUntil.getTime() > Date.now());
  }

  private parseExpiresInToDate(expiresIn: string): Date {
    const durationMs = this.parseDurationToMs(expiresIn);
    return new Date(Date.now() + durationMs);
  }

  private parseDurationToMs(value: string): number {
    const match = /^(?<amount>\d+)(?<unit>ms|s|m|h|d)$/i.exec(value.trim());

    if (!match?.groups) {
      return 30 * 24 * 60 * 60 * 1000;
    }

    const amount = Number(match.groups.amount);
    const unit = match.groups.unit.toLowerCase();
    const multipliers: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return amount * multipliers[unit];
  }

  private toRegisteredUser(user: {
    id: string;
    email: string;
    name: string;
    isEmailVerified?: boolean;
  }): RegisteredUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isEmailVerified: user.isEmailVerified ?? false,
    };
  }

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002',
    );
  }
}
