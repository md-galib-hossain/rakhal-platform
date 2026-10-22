import { createHash, randomBytes } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PlatformAdmin, PlatformAdminSession } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AdminAuditService } from './admin-audit.service';

/** Refresh-token lifetime. Access tokens stay short (`JWT_ADMIN_EXPIRES_IN`). */
export const ADMIN_REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AdminClientContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface IssuedAdminSession {
  session: PlatformAdminSession;
  /** Opaque, returned to the client once; only its hash is stored. */
  refreshToken: string;
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

/**
 * Platform-admin sessions (P2-01). One row per sign-in; the access JWT carries
 * its id (`sid`) and `PlatformAdminGuard` re-checks it every request, so
 * logout/revoke are effective immediately. Refresh tokens rotate on every use;
 * presenting an already-rotated token is treated as theft and revokes the
 * session.
 */
@Injectable()
export class AdminSessionService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(AdminSessionService.name);
  }

  async create(
    adminId: string,
    client: AdminClientContext,
  ): Promise<IssuedAdminSession> {
    const refreshToken = newRefreshToken();
    const session = await this.prisma.platformAdminSession.create({
      data: {
        adminId,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + ADMIN_REFRESH_TTL_MS),
        ipAddress: client.ipAddress ?? null,
        userAgent: client.userAgent?.slice(0, 255) ?? null,
      },
    });
    return { session, refreshToken };
  }

  /**
   * Exchanges a refresh token for a rotated one. Returns the owning admin so
   * the caller can mint a fresh access token.
   */
  async rotate(
    presented: string,
    client: AdminClientContext,
  ): Promise<IssuedAdminSession & { admin: PlatformAdmin }> {
    const hash = hashRefreshToken(presented);

    const current = await this.prisma.platformAdminSession.findUnique({
      where: { refreshTokenHash: hash },
      include: { admin: true },
    });

    if (!current) {
      await this.handlePossibleReuse(hash, client);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { admin, ...session } = current;
    if (
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !admin.isActive ||
      !admin.totpEnabled
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshToken = newRefreshToken();
    // Compare-and-swap on the presented hash: of two concurrent refreshes with
    // the same token only one wins; the loser looks like a replay.
    const swapped = await this.prisma.platformAdminSession.updateMany({
      where: { id: session.id, refreshTokenHash: hash, revokedAt: null },
      data: {
        refreshTokenHash: hashRefreshToken(refreshToken),
        previousRefreshTokenHash: hash,
        lastUsedAt: new Date(),
        ipAddress: client.ipAddress ?? session.ipAddress,
      },
    });
    if (swapped.count !== 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const updated = await this.prisma.platformAdminSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    return { session: updated, refreshToken, admin };
  }

  /** A hash that is no longer current but equals a session's previous hash. */
  private async handlePossibleReuse(
    hash: string,
    client: AdminClientContext,
  ): Promise<void> {
    const replayed = await this.prisma.platformAdminSession.findFirst({
      where: { previousRefreshTokenHash: hash, revokedAt: null },
    });
    if (!replayed) return;

    await this.prisma.platformAdminSession.update({
      where: { id: replayed.id },
      data: { revokedAt: new Date(), revokedReason: 'REFRESH_TOKEN_REUSE' },
    });
    this.log.warn('Admin refresh-token reuse detected; session revoked', {
      adminId: replayed.adminId,
      sessionId: replayed.id,
    });
    await this.audit.record({
      adminId: replayed.adminId,
      action: 'SESSION_REUSE_DETECTED',
      entityType: 'PlatformAdminSession',
      entityId: replayed.id,
      ipAddress: client.ipAddress,
    });
  }

  /** Used by `PlatformAdminGuard` on every request. */
  async isActive(sessionId: string, adminId: string): Promise<boolean> {
    const session = await this.prisma.platformAdminSession.findUnique({
      where: { id: sessionId },
      select: { adminId: true, revokedAt: true, expiresAt: true },
    });
    return (
      !!session &&
      session.adminId === adminId &&
      session.revokedAt === null &&
      session.expiresAt > new Date()
    );
  }

  listActive(adminId: string) {
    return this.prisma.platformAdminSession.findMany({
      where: {
        adminId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
      },
    });
  }

  /** Revokes one of the admin's own sessions; false when none matched. */
  async revoke(
    adminId: string,
    sessionId: string,
    reason: string,
    ipAddress?: string,
  ): Promise<boolean> {
    const result = await this.prisma.platformAdminSession.updateMany({
      where: { id: sessionId, adminId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    if (result.count === 0) return false;
    await this.audit.record({
      adminId,
      action: reason === 'LOGOUT' ? 'LOGOUT' : 'SESSION_REVOKED',
      entityType: 'PlatformAdminSession',
      entityId: sessionId,
      ipAddress,
    });
    return true;
  }

  /** Revokes every live session of an admin (optionally keeping one). */
  async revokeAll(
    adminId: string,
    reason: string,
    exceptSessionId?: string,
    ipAddress?: string,
  ): Promise<number> {
    const result = await this.prisma.platformAdminSession.updateMany({
      where: {
        adminId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    if (result.count > 0) {
      await this.audit.record({
        adminId,
        action: 'SESSIONS_REVOKED_ALL',
        entityType: 'PlatformAdmin',
        entityId: adminId,
        metadata: { count: result.count, reason },
        ipAddress,
      });
    }
    return result.count;
  }
}
