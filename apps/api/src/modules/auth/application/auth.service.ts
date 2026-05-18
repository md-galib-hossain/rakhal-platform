import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { LoginDto } from '../dto/login.dto';
import { LogoutDto } from '../dto/logout.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterDto } from '../dto/register.dto';
import { RevokeSessionDto } from '../dto/revoke-session.dto';
import { AuthRepository } from '../repositories/auth.repository';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import { RegisterResult } from '../domain/register-result.type';
import { RegisteredUser } from '../domain/registered-user.type';
import { LoginResult } from '../domain/login-result.type';
import { LoginContext } from '../domain/login-context.type';
import { authConfig } from 'src/core/config/env';
import { AuthTokenPayload } from '../domain/auth-token-payload.type';

@Injectable()
export class AuthService {
  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
    private readonly authRepository: AuthRepository,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    const passwordHash = await this.passwordService.hashPassword(dto.password);
    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenHash = this.hashToken(verificationToken);

    try {
      const user = await this.authRepository.registerUserWithVerification({
        email: dto.email,
        name: dto.name,
        passwordHash,
        verificationTokenHash,
        verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      return {
        user: this.toRegisteredUser(user),
        emailVerificationToken: verificationToken,
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Email already exists');
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    return this.loginWithContext(dto);
  }

  async refresh(dto: RefreshTokenDto) {
    if (!dto.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const storedToken = await this.refreshTokenService.findByRawToken(
      dto.refreshToken,
    );

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      refreshTokenId: storedToken.id,
      sessionId: storedToken.sessionId,
    };
  }

  logout(dto: LogoutDto) {
    void dto;
    return {
      success: true,
    };
  }

  logoutAll(userId: string) {
    return this.sessionService.revokeAllSessionsForUser(userId);
  }

  sessions(userId: string) {
    return this.sessionService.listUserSessions(userId);
  }

  revokeSession(dto: RevokeSessionDto) {
    return this.sessionService.revokeSession(dto.sessionId);
  }

  me(userId: string) {
    return this.authRepository.findUserById(userId);
  }

  async loginWithContext(
    dto: LoginDto,
    context: LoginContext = {},
  ): Promise<LoginResult> {
    const user = await this.authRepository.findUserByEmail(dto.email);

    if (!user?.passwordHash || user.deletedAt) {
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
    isEmailVerified: boolean;
  }): RegisteredUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isEmailVerified: user.isEmailVerified,
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
