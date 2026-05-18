import { Injectable } from '@nestjs/common';
import { AuditAction, SessionStatus, TokenType, User } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  createUser(data: { email: string; name: string; passwordHash: string }) {
    return this.prisma.user.create({ data });
  }

  registerUserWithVerification(data: {
    email: string;
    name: string;
    passwordHash: string;
    verificationTokenHash: string;
    verificationExpiresAt: Date;
  }) {
    return this.prisma.$transaction(async (prisma) => {
      const user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash: data.passwordHash,
        },
      });

      await prisma.authToken.create({
        data: {
          userId: user.id,
          type: TokenType.EMAIL_VERIFICATION,
          tokenHash: data.verificationTokenHash,
          expiresAt: data.verificationExpiresAt,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.REGISTER,
          entityType: 'User',
          entityId: user.id,
          metadata: {
            emailDomain: data.email.split('@')[1] ?? null,
          },
        },
      });

      return user;
    });
  }

  recordFailedLoginAttempt(data: {
    userId: string;
    failedLoginAttempts: number;
    lockedUntil?: Date | null;
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
    reason: string;
  }) {
    return this.prisma.$transaction(async (prisma) => {
      const user = await prisma.user.update({
        where: { id: data.userId },
        data: {
          failedLoginAttempts: data.failedLoginAttempts,
          lockedUntil: data.lockedUntil ?? undefined,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorUserId: data.userId,
          action: AuditAction.SUSPICIOUS_ACTIVITY,
          entityType: 'User',
          entityId: data.userId,
          metadata: {
            reason: data.reason,
            failedLoginAttempts: data.failedLoginAttempts,
          },
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });

      return user;
    });
  }

  recordSuspiciousLogin(data: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
    reason: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: data.userId,
        action: AuditAction.SUSPICIOUS_ACTIVITY,
        entityType: 'User',
        entityId: data.userId,
        metadata: {
          reason: data.reason,
          deviceName: data.deviceName ?? null,
        },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  completeSuccessfulLogin(data: {
    userId: string;
    sessionExpiresAt: Date;
    refreshTokenHash: string;
    tokenFamily: string;
    refreshTokenExpiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
  }) {
    return this.prisma.$transaction(async (prisma) => {
      const user = await prisma.user.update({
        where: { id: data.userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
      });

      const session = await prisma.session.create({
        data: {
          userId: data.userId,
          status: SessionStatus.ACTIVE,
          expiresAt: data.sessionExpiresAt,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          deviceName: data.deviceName,
        },
      });

      await prisma.refreshToken.create({
        data: {
          sessionId: session.id,
          tokenHash: data.refreshTokenHash,
          tokenFamily: data.tokenFamily,
          expiresAt: data.refreshTokenExpiresAt,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorUserId: data.userId,
          action: AuditAction.LOGIN,
          entityType: 'Session',
          entityId: session.id,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: {
            deviceName: data.deviceName ?? null,
          },
        },
      });

      return { user, session };
    });
  }

  createSession(data: {
    userId: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
  }) {
    return this.prisma.session.create({
      data: {
        ...data,
        status: SessionStatus.ACTIVE,
      },
    });
  }

  getUserSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  revokeSession(sessionId: string) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.REVOKED },
    });
  }

  revokeAllSessionsForUser(userId: string) {
    return this.prisma.session.updateMany({
      where: {
        userId,
        status: SessionStatus.ACTIVE,
      },
      data: {
        status: SessionStatus.REVOKED,
      },
    });
  }

  createRefreshToken(data: {
    sessionId: string;
    tokenHash: string;
    tokenFamily: string;
    expiresAt: Date;
    parentTokenId?: string;
  }) {
    return this.prisma.refreshToken.create({
      data: {
        sessionId: data.sessionId,
        tokenHash: data.tokenHash,
        tokenFamily: data.tokenFamily,
        expiresAt: data.expiresAt,
        parentTokenId: data.parentTokenId,
      },
    });
  }

  findRefreshTokenByHash(tokenHash: string) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { session: true },
    });
  }

  revokeRefreshToken(tokenId: string) {
    return this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }
}
