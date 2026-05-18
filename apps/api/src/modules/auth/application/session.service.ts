import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
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

  findSessionById(sessionId: string) {
    return this.authRepository.findSessionById(sessionId);
  }

  revokeSessionForUser(
    sessionId: string,
    userId: string,
    auditAction: AuditAction,
  ) {
    return this.authRepository.revokeSessionForUser({
      sessionId,
      userId,
      auditAction,
    });
  }

  revokeAllSessionsForUser(userId: string) {
    return this.authRepository.revokeAllSessionsForUser(userId);
  }
}
