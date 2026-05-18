import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenPayload } from '../domain/auth-token-payload.type';

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  signAccessToken(payload: AuthTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }
}
