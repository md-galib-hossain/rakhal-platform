import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { env } from 'src/core/config/env';
import { AdminTokenPayload } from '../../domain/admin-token-payload.type';

type JwtDuration = `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y'}`;

/**
 * Signs/verifies platform-admin JWTs with the **dedicated** `JWT_ADMIN_SECRET`
 * (RAKHAL-224, ADR-019) — a self-contained `JwtService` instance, never the
 * global farm one. This is the hard boundary between the two API surfaces: a
 * farm token (signed with `JWT_ACCESS_SECRET`) fails admin verification and an
 * admin token fails farm verification.
 */
@Injectable()
export class AdminTokenService {
  private readonly jwt = new JwtService();
  private readonly secret = env.JWT_ADMIN_SECRET;
  private readonly expiresIn = env.JWT_ADMIN_EXPIRES_IN as JwtDuration;

  sign(
    payload: AdminTokenPayload,
    expiresIn: JwtDuration = this.expiresIn,
  ): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.secret,
      expiresIn,
    });
  }

  verify(token: string): Promise<AdminTokenPayload> {
    return this.jwt.verifyAsync<AdminTokenPayload>(token, {
      secret: this.secret,
    });
  }
}
