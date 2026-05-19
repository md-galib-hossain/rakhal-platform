import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { authConfig } from 'src/core/config/env';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthController } from './presentation/controllers/auth.controller';
import { AuthService } from './application/services/auth.service';
import { CsrfService } from './application/services/csrf.service';
import { PermissionsVersionCacheService } from './application/services/permissions-version-cache.service';
import { PasswordService } from './application/services/password.service';
import { RefreshTokenService } from './application/services/refresh-token.service';
import { SessionService } from './application/services/session.service';
import { TokenService } from './application/services/token.service';
import { AuthRepository } from './infrastructure/persistence/repositories/auth.repository';
import { CsrfGuard } from './presentation/guards/csrf.guard';
import { AccessTokenStrategy } from './presentation/strategies/access-token.strategy';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { SessionGuard } from './presentation/guards/session.guard';

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
    CsrfService,
    PermissionsVersionCacheService,
    AuthRepository,
    AccessTokenStrategy,
    JwtAuthGuard,
    SessionGuard,
    CsrfGuard,
  ],
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    SessionService,
    RefreshTokenService,
    CsrfService,
    AuthRepository,
  ],
})
export class AuthModule {}
