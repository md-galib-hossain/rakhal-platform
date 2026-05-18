import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AuthService } from './application/auth.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RevokeSessionDto } from './dto/revoke-session.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);

    return {
      user: result.user,
    };
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto);
  }

  @Post('logout-all')
  logoutAll(@Query('userId') userId: string) {
    return this.authService.logoutAll(userId);
  }

  @Get('sessions')
  sessions(@Query('userId') userId: string) {
    return this.authService.sessions(userId);
  }

  @Delete('sessions/:sessionId')
  revokeSession(@Param('sessionId') sessionId: string) {
    const dto: RevokeSessionDto = { sessionId };
    return this.authService.revokeSession(dto);
  }

  @Get('me')
  me(@Query('userId') userId: string) {
    return this.authService.me(userId);
  }
}
