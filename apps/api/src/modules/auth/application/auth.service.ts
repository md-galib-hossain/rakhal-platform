import { Injectable, UnauthorizedException } from '@nestjs/common';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await this.passwordService.hashPassword(dto.password);

    return this.authRepository.createUser({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });
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
}
