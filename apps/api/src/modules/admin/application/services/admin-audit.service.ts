import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { ListAdminAuditQueryDto } from '../../presentation/dto/list-admin-audit.dto';
import { PlatformAdminAuditLog } from '@prisma/client';
import { LoggerContext } from 'src/core/logger/logger/logger.context';
import {
  AdminAuditAction,
  AdminAuditOutcome,
  redactAuditPayload,
} from '../../domain/admin-audit-actions';

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
    private readonly requestContext: LoggerContext,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(AdminAuditService.name);
  }

  /**
   * Appends one audit row (P2-04). `requestId`, `sessionId`, `ipAddress` and
   * `userAgent` default to the in-flight request's context (set by
   * `PlatformAdminGuard` / the request-context middleware) so call sites only
   * state what happened. Payloads are redacted before they are stored.
   */
  async record(data: {
    /** Null for a failed login against an unknown email. */
    adminId?: string | null;
    action: AdminAuditAction;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown> | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    outcome?: AdminAuditOutcome;
    actorEmail?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    sessionId?: string | null;
    requestId?: string | null;
  }): Promise<void> {
    const ctx = this.requestContext.get();
    const metadata = redactAuditPayload(data.metadata ?? null);
    const before = redactAuditPayload(data.before ?? null);
    const after = redactAuditPayload(data.after ?? null);

    this.log.audit(`admin.${data.action}`, {
      actorUserId: data.adminId ?? null,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      outcome: data.outcome ?? 'SUCCESS',
      metadata,
    });
    await this.prisma.platformAdminAuditLog.create({
      data: {
        adminId: data.adminId ?? null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId ?? null,
        metadata: (metadata ?? undefined) as never,
        before: (before ?? undefined) as never,
        after: (after ?? undefined) as never,
        outcome: data.outcome ?? 'SUCCESS',
        actorEmail: data.actorEmail?.slice(0, 254) ?? null,
        ipAddress:
          data.ipAddress ?? (ctx?.['ipAddress'] as string | undefined) ?? null,
        userAgent:
          (
            data.userAgent ??
            (ctx?.['userAgent'] as string | undefined) ??
            null
          )?.slice(0, 255) ?? null,
        sessionId: data.sessionId ?? ctx?.sessionId ?? null,
        requestId: data.requestId ?? ctx?.requestId ?? null,
      },
    });
  }

  /** `GET /admin/audit` (ADM-03) — the immutable trail, newest first. */
  async list(
    query: ListAdminAuditQueryDto,
  ): Promise<CursorPage<PlatformAdminAuditLog>> {
    const rows = await this.prisma.platformAdminAuditLog.findMany({
      where: {
        adminId: query.adminId,
        action: query.action,
      },
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    return toCursorPage(rows, query);
  }
}
