import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { authConfig } from 'src/core/config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './application/auth.service';
import { PasswordService } from './application/password.service';
import { RefreshTokenService } from './application/refresh-token.service';
import { SessionService } from './application/session.service';
import { TokenService } from './application/token.service';
import { AuthRepository } from './repositories/auth.repository';

@Module({
  imports: [ConfigModule.forFeature(authConfig)],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    SessionService,
    RefreshTokenService,
    AuthRepository,
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
