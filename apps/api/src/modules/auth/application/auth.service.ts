import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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

@Injectable()
export class AuthService {
  constructor(
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

  async login(dto: LoginDto) {
    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.passwordService.verifyPassword(
      user.passwordHash,
      dto.password,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const session = await this.sessionService.createSession({
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      sessionId: session.id,
      farmId: dto.farmId,
      permissionsVersion: user.permissionsVersion,
    });

    return {
      accessToken,
      sessionId: session.id,
      userId: user.id,
    };
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
