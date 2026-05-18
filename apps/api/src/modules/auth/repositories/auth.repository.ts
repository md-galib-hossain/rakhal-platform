import { Injectable } from '@nestjs/common';
import { SessionStatus, User } from '@prisma/client';
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
