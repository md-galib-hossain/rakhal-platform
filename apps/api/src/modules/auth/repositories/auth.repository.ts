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

  findSessionById(sessionId: string) {
    return this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            permissionsVersion: true,
            isBlocked: true,
            deletedAt: true,
          },
        },
      },
    });
  }

  revokeSessionForUser(data: {
    sessionId: string;
    userId: string;
    auditAction: AuditAction;
  }) {
    return this.prisma.$transaction(async (prisma) => {
      const session = await prisma.session.findFirst({
        where: {
          id: data.sessionId,
          userId: data.userId,
        },
        select: {
          id: true,
        },
      });

      if (!session) {
        return null;
      }

      await prisma.session.update({
        where: { id: data.sessionId },
        data: {
          status: SessionStatus.REVOKED,
        },
      });

      const revokedRefreshTokens = await prisma.refreshToken.updateMany({
        where: {
          sessionId: data.sessionId,
        },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          actorUserId: data.userId,
          action: data.auditAction,
          entityType: 'Session',
          entityId: data.sessionId,
          metadata: {
            revokedRefreshTokens: revokedRefreshTokens.count,
          },
        },
      });

      return {
        sessionId: data.sessionId,
        revokedRefreshTokens: revokedRefreshTokens.count,
      };
    });
  }

  revokeAllSessionsForUser(userId: string) {
    return this.prisma.$transaction(async (prisma) => {
      const activeSessions = await prisma.session.findMany({
        where: {
          userId,
          status: SessionStatus.ACTIVE,
        },
        select: {
          id: true,
        },
      });

      const sessionIds = activeSessions.map((session) => session.id);

      if (sessionIds.length === 0) {
        return {
          revokedSessions: 0,
          revokedRefreshTokens: 0,
        };
      }

      const revokedSessions = await prisma.session.updateMany({
        where: {
          id: {
            in: sessionIds,
          },
        },
        data: {
          status: SessionStatus.REVOKED,
        },
      });

      const revokedRefreshTokens = await prisma.refreshToken.updateMany({
        where: {
          sessionId: {
            in: sessionIds,
          },
        },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          actorUserId: userId,
          action: AuditAction.LOGOUT,
          entityType: 'User',
          entityId: userId,
          metadata: {
            scope: 'all-sessions',
            revokedSessions: revokedSessions.count,
            revokedRefreshTokens: revokedRefreshTokens.count,
          },
        },
      });

      return {
        revokedSessions: revokedSessions.count,
        revokedRefreshTokens: revokedRefreshTokens.count,
      };
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
      include: {
        session: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                permissionsVersion: true,
                isBlocked: true,
                deletedAt: true,
              },
            },
          },
        },
      },
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

  completeRefreshRotation(data: {
    refreshTokenId: string;
    tokenFamily: string;
    tokenHash: string;
    tokenExpiresAt: Date;
    parentTokenId: string;
    sessionId: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
    farmId: string;
    refreshReason: string;
  }) {
    return this.prisma.$transaction(async (prisma) => {
      const previousToken = await prisma.refreshToken.update({
        where: { id: data.refreshTokenId },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });

      const nextToken = await prisma.refreshToken.create({
        data: {
          sessionId: data.sessionId,
          tokenHash: data.tokenHash,
          tokenFamily: data.tokenFamily,
          parentTokenId: data.parentTokenId,
          expiresAt: data.tokenExpiresAt,
        },
      });

      const session = await prisma.session.update({
        where: { id: data.sessionId },
        data: {
          lastUsedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          actorUserId: data.userId,
          action: AuditAction.LOGIN,
          entityType: 'Session',
          entityId: data.sessionId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: {
            event: 'refresh-rotated',
            deviceName: data.deviceName ?? null,
            farmId: data.farmId,
            tokenFamily: data.tokenFamily,
            parentTokenId: data.parentTokenId,
            previousTokenId: previousToken.id,
            nextTokenId: nextToken.id,
          },
        },
      });

      return { nextToken, session };
    });
  }

  markRefreshReuse(data: {
    refreshTokenId: string;
    tokenFamily: string;
    sessionId: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
    farmId: string;
    reason: string;
  }) {
    return this.prisma.$transaction(async (prisma) => {
      const compromisedSession = await prisma.session.update({
        where: { id: data.sessionId },
        data: {
          status: SessionStatus.COMPROMISED,
        },
      });

      await prisma.refreshToken.updateMany({
        where: {
          tokenFamily: data.tokenFamily,
        },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          actorUserId: data.userId,
          action: AuditAction.SUSPICIOUS_ACTIVITY,
          entityType: 'Session',
          entityId: data.sessionId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: {
            event: 'refresh-token-reuse',
            reason: data.reason,
            deviceName: data.deviceName ?? null,
            farmId: data.farmId,
            tokenFamily: data.tokenFamily,
            refreshTokenId: data.refreshTokenId,
          },
        },
      });

      return compromisedSession;
    });
  }
}
