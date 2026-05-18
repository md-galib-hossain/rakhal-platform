import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { authConfig } from 'src/core/config/env';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthController } from './auth.controller';
import { AuthService } from './application/auth.service';
import { PermissionsVersionCacheService } from './application/permissions-version-cache.service';
import { PasswordService } from './application/password.service';
import { RefreshTokenService } from './application/refresh-token.service';
import { SessionService } from './application/session.service';
import { TokenService } from './application/token.service';
import { AuthRepository } from './repositories/auth.repository';
import { AccessTokenStrategy } from './strategies/access-token.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SessionGuard } from './guards/session.guard';

@Module({
  imports: [
    ConfigModule.forFeature(authConfig),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    LoggerModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    SessionService,
    RefreshTokenService,
    PermissionsVersionCacheService,
    AuthRepository,
    AccessTokenStrategy,
    JwtAuthGuard,
    SessionGuard,
  ],
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    SessionService,
    RefreshTokenService,
    AuthRepository,
  ],
})
export class AuthModule {}
