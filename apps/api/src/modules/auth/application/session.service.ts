import { Injectable } from '@nestjs/common';
import { AuthRepository } from '../repositories/auth.repository';

@Injectable()
export class SessionService {
  constructor(private readonly authRepository: AuthRepository) {}

  createSession(data: {
    userId: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
  }) {
    return this.authRepository.createSession(data);
  }

  listUserSessions(userId: string) {
    return this.authRepository.getUserSessions(userId);
  }

  revokeSession(sessionId: string) {
    return this.authRepository.revokeSession(sessionId);
  }

  revokeAllSessionsForUser(userId: string) {
    return this.authRepository.revokeAllSessionsForUser(userId);
  }
}
