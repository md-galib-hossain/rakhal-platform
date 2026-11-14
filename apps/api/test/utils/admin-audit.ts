import type { PrismaService } from '../../src/core/database/prisma/prisma.service';

/**
 * `PlatformAdminAuditLog` is append-only (P2-04 trigger): DELETE is rejected
 * unless the transaction sets `rakhal.audit_purge = 'on'`. Test teardown for a
 * throwaway admin goes through this helper — never use it on a real admin.
 */
export async function purgeAdminAudit(
  prisma: PrismaService,
  adminId: string,
  /** Also clear rows with no admin (failed logins) for these attempted emails. */
  actorEmails: string[] = [],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('rakhal.audit_purge', 'on', true)`;
    await tx.platformAdminAuditLog.deleteMany({
      where: {
        OR: [
          { adminId },
          ...(actorEmails.length
            ? [{ adminId: null, actorEmail: { in: actorEmails } }]
            : []),
        ],
      },
    });
  });
}
