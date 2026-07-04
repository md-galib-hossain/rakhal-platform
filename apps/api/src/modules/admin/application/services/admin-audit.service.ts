import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';

/**
 * Immutable audit trail for platform-admin actions (RAKHAL-224). Separate from
 * the farm `AuditService` because the actor is a `PlatformAdmin`, not a `User`
 * (the farm `AuditLog.actorUserId` FKs `User`). Structured-logs + persists.
 * RAKHAL-225 grows this into the full admin audit surface.
 */
@Injectable()
export class AdminAuditService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(AdminAuditService.name);
  }

  async record(data: {
    adminId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown> | null;
    ipAddress?: string | null;
  }): Promise<void> {
    this.log.audit(`admin.${data.action}`, {
      actorUserId: data.adminId,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      metadata: data.metadata ?? null,
    });
    await this.prisma.platformAdminAuditLog.create({
      data: {
        adminId: data.adminId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId ?? null,
        metadata: (data.metadata ?? undefined) as never,
        ipAddress: data.ipAddress ?? null,
      },
    });
  }
}
