import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { AuditAction, Language, SessionStatus } from '@prisma/client';
import { AppLanguage } from 'src/common/i18n/language';
import { createHash, randomBytes } from 'crypto';
import { DomainEventBusService } from 'src/common/events/domain-event-bus.service';
import { authConfig } from 'src/core/config/env';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { USER_REGISTERED_EVENT } from 'src/modules/auth/domain/events/user-registered.event';
import {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  LogoutInput,
  RefreshTokenInput,
  RegisterInput,
  ResetPasswordInput,
  RevokeSessionInput,
} from '../dto/auth.inputs';
import { LoginContext } from '../../domain/login-context.type';
import { LoginResult } from '../../domain/login-result.type';
import { RegisterResult } from '../../domain/register-result.type';
import { RegisteredUser } from '../../domain/registered-user.type';
import { AuthTokenPayload } from '../../domain/auth-token-payload.type';
import { AuthRepository } from '../../infrastructure/persistence/repositories/auth.repository';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { PasswordService } from './password.service';
import { PermissionsVersionCacheService } from './permissions-version-cache.service';
import { RefreshTokenService } from './refresh-token.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import { PASSWORD_CHANGED_EVENT } from 'src/modules/auth/domain/events/password-changed.event';
import { PASSWORD_RESET_REQUESTED_EVENT } from 'src/modules/auth/domain/events/password-reset-requested.event';
import { PASSWORD_RESET_SUCCESSFUL_EVENT } from 'src/modules/auth/domain/events/password-reset-successful.event';

@Injectable()
export class AuthService {
  private readonly log: LoggerService;
  private readonly passwordResetTokenTtlMinutes = 30;

  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
    private readonly authRepository: AuthRepository,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly permissionsVersionCache: PermissionsVersionCacheService,
    private readonly permissionService: PermissionService,
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

  /** Never returns `passwordHash` (RAKHAL-259 — it used to leak via `findUserById`).
   * `permissions` (RAKHAL-260) is best-effort: a `bootstrap`-scoped token or a user with no
   * membership on the token's farm has nothing to resolve, so it degrades to `[]` rather than
   * failing the whole request. */
  async me(userId: string, farmId: string, permissionsVersion: number) {
    const user = await this.authRepository.findSafeUserById(userId);
    const permissions = await this.resolvePermissionsSafely(
      userId,
      farmId,
      permissionsVersion,
    );

    return { ...user, permissions };
  }

  private async resolvePermissionsSafely(
    userId: string,
    farmId: string,
    permissionsVersion: number,
  ): Promise<string[]> {
    try {
      return await this.permissionService.resolvePermissions(
        userId,
        farmId,
        permissionsVersion,
      );
    } catch {
      return [];
    }
  }

  /** Language toggle persists to the user's profile (RAKHAL-107). */
  updateLanguage(userId: string, preferredLanguage: AppLanguage) {
    return this.authRepository.updatePreferredLanguage(
      userId,
      preferredLanguage.toUpperCase() as Language,
    );
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

  async forgotPassword(email: string): Promise<{ success: true }> {
    const input: ForgotPasswordInput = { email };
    const user = await this.authRepository.findUserByEmail(input.email);

    if (user) {
      const resetToken = randomBytes(48).toString('hex');
      const tokenHash = this.hashToken(resetToken);
      const expiresAt = new Date(
        Date.now() + this.passwordResetTokenTtlMinutes * 60 * 1000,
      );

      await this.authRepository.createResetToken({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      this.eventBus.emit(PASSWORD_RESET_REQUESTED_EVENT, {
        userId: user.id,
        email: user.email,
        name: user.name,
        token: resetToken,
        tenantId: user.id,
        farmId: null,
      });

      this.log.audit('auth.password_reset_requested', {
        userId: user.id,
        tenantId: user.id,
        farmId: null,
        correlationId: null,
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ success: true }> {
    const tokenHash = this.hashToken(input.token);
    const resetToken = await this.authRepository.findResetToken(tokenHash);

    if (!resetToken?.user) {
      throw new UnauthorizedException('Invalid reset token');
    }

    const nextPasswordHash = await this.passwordService.hashPassword(
      input.newPassword,
    );

    await this.authRepository.updateUserPassword(
      resetToken.user.id,
      nextPasswordHash,
    );
    await this.authRepository.markResetTokenUsed(resetToken.id);
    await this.revokeAccessAfterPasswordUpdate(resetToken.user.id);

    this.eventBus.emit(PASSWORD_RESET_SUCCESSFUL_EVENT, {
      userId: resetToken.user.id,
      tenantId: resetToken.user.id,
      farmId: null,
    });

    this.log.audit('auth.password_reset_successful', {
      userId: resetToken.user.id,
      tenantId: resetToken.user.id,
      farmId: null,
      correlationId: null,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<{ success: true }> {
    const user = await this.authRepository.findUserById(userId);

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isCurrentPasswordValid = await this.passwordService.verifyPassword(
      user.passwordHash,
      input.currentPassword,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const nextPasswordHash = await this.passwordService.hashPassword(
      input.newPassword,
    );

    await this.authRepository.updateUserPassword(user.id, nextPasswordHash);
    await this.revokeAccessAfterPasswordUpdate(user.id);

    this.eventBus.emit(PASSWORD_CHANGED_EVENT, {
      userId: user.id,
      tenantId: user.id,
      farmId: null,
    });

    this.log.audit('auth.password_changed', {
      userId: user.id,
      tenantId: user.id,
      farmId: null,
      correlationId: null,
      timestamp: new Date().toISOString(),
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

  private async revokeAccessAfterPasswordUpdate(userId: string): Promise<void> {
    await this.sessionService.revokeAllSessionsForUser(userId);
    await this.permissionsVersionCache.invalidate(userId);
    await this.permissionService.invalidateForUser(userId);
  }
}
