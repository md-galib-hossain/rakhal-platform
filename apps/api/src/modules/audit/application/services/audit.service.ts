import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';

@Injectable()
export class AuditService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(AuditService.name);
  }

  record(data: {
    actorUserId: string;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    farmId?: string | null;
    metadata?: Record<string, unknown> | null;
    ipAddress?: string;
    userAgent?: string;
  }) {
    this.log.audit(data.action, {
      actorUserId: data.actorUserId,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      farmId: data.farmId ?? null,
      metadata: data.metadata ?? null,
    });

    return this.prisma.auditLog.create({
      data: {
        actorUserId: data.actorUserId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId ?? null,
        farmId: data.farmId ?? null,
        metadata: (data.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  logLogin(data: {
    actorUserId: string;
    sessionId: string;
    farmId?: string | null;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.record({
      actorUserId: data.actorUserId,
      action: AuditAction.LOGIN,
      entityType: 'Session',
      entityId: data.sessionId,
      farmId: data.farmId ?? null,
      metadata: data.metadata ?? null,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });
  }

  logLogout(data: {
    actorUserId: string;
    sessionId: string;
    farmId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return this.record({
      actorUserId: data.actorUserId,
      action: AuditAction.LOGOUT,
      entityType: 'Session',
      entityId: data.sessionId,
      farmId: data.farmId ?? null,
      metadata: data.metadata ?? null,
    });
  }

  logSessionRevoked(data: {
    actorUserId: string;
    sessionId: string;
    farmId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return this.record({
      actorUserId: data.actorUserId,
      action: AuditAction.SESSION_REVOKED,
      entityType: 'Session',
      entityId: data.sessionId,
      farmId: data.farmId ?? null,
      metadata: data.metadata ?? null,
    });
  }

  logPasswordChanged(data: {
    actorUserId: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.record({
      actorUserId: data.actorUserId,
      action: AuditAction.PASSWORD_CHANGED,
      entityType: 'User',
      entityId: data.actorUserId,
      metadata: data.metadata ?? null,
    });
  }

  logRefreshReuse(data: {
    actorUserId: string;
    sessionId: string;
    farmId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return this.record({
      actorUserId: data.actorUserId,
      action: AuditAction.SUSPICIOUS_ACTIVITY,
      entityType: 'Session',
      entityId: data.sessionId,
      farmId: data.farmId ?? null,
      metadata: {
        event: 'refresh-token-reuse',
        ...data.metadata,
      },
    });
  }

  logRoleChanged(data: {
    actorUserId: string;
    farmId?: string | null;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.record({
      actorUserId: data.actorUserId,
      action: AuditAction.ROLE_UPDATED,
      entityType: 'Role',
      entityId: data.entityId ?? data.actorUserId,
      farmId: data.farmId ?? null,
      metadata: data.metadata ?? null,
    });
  }

  logMembershipChanged(data: {
    actorUserId: string;
    farmId?: string | null;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.record({
      actorUserId: data.actorUserId,
      action: AuditAction.MEMBER_REMOVED,
      entityType: 'FarmMember',
      entityId: data.entityId ?? data.actorUserId,
      farmId: data.farmId ?? null,
      metadata: data.metadata ?? null,
    });
  }

  logSubscriptionChanged(data: {
    actorUserId: string;
    farmId?: string | null;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.record({
      actorUserId: data.actorUserId,
      action: AuditAction.SUBSCRIPTION_UPDATED,
      entityType: 'FarmSubscription',
      entityId: data.entityId ?? data.actorUserId,
      farmId: data.farmId ?? null,
      metadata: data.metadata ?? null,
    });
  }
}
