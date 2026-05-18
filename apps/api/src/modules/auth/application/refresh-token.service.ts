import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { AuthRepository } from '../repositories/auth.repository';

@Injectable()
export class RefreshTokenService {
  constructor(private readonly authRepository: AuthRepository) {}

  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  generateToken(): string {
    return randomBytes(48).toString('hex');
  }

  async storeRefreshToken(data: {
    sessionId: string;
    rawToken: string;
    expiresAt: Date;
    tokenFamily?: string;
    parentTokenId?: string;
  }) {
    const tokenFamily = data.tokenFamily ?? randomUUID();

    return this.authRepository.createRefreshToken({
      sessionId: data.sessionId,
      tokenHash: this.hashToken(data.rawToken),
      tokenFamily,
      parentTokenId: data.parentTokenId,
      expiresAt: data.expiresAt,
    });
  }

  findByRawToken(rawToken: string) {
    return this.authRepository.findRefreshTokenByHash(this.hashToken(rawToken));
  }

  revokeToken(tokenId: string) {
    return this.authRepository.revokeRefreshToken(tokenId);
  }
}
