import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';

export const REPORT_JOB_LOCK = Symbol('REPORT_JOB_LOCK');

export type LockedRun<T> = { acquired: true; value: T } | { acquired: false };

/** Cross-instance mutual exclusion for one named cron job. */
export interface ReportJobLock {
  /** Runs `fn` only if no other holder has `jobName`; resolves `{acquired:false}` immediately otherwise. */
  runExclusive<T>(jobName: string, fn: () => Promise<T>): Promise<LockedRun<T>>;
}

/** Upper bound for one locked job; the lock is released when the transaction ends either way. */
const LOCK_TX_TIMEOUT_MS = 30 * 60 * 1000;
const LOCK_TX_MAX_WAIT_MS = 5_000;

/**
 * Postgres advisory lock held for the duration of the job.
 *
 * Design note: a SESSION-level `pg_try_advisory_lock` needs one connection pinned for lock + unlock, which
 * Prisma's pool does not offer and `pg` is not a direct dependency here. So the lock is the TRANSACTION-level
 * `pg_try_advisory_xact_lock(hashtext('reports:<job>'))` taken inside a dedicated interactive transaction
 * that stays open while `fn` runs (on other pool connections). The lock is released when the transaction
 * ends (commit, rollback or timeout) and, if the process dies, when Postgres drops the connection, so a
 * crashed holder never wedges the job. Cost: one pool connection is parked per running job.
 *
 * Runtime assumptions (operational, not enforced in code):
 *  1. Postgres `idle_in_transaction_session_timeout` must exempt the app role or be 0: the lock transaction
 *     sits idle-in-transaction for up to LOCK_TX_TIMEOUT_MS (30 min) while `fn` runs on other connections;
 *     a shorter server-side timeout would kill it and silently drop the lock mid-job.
 *  2. Overrun: a job that runs past LOCK_TX_TIMEOUT_MS (30 min) has its lock transaction rolled back by
 *     Prisma, which releases the lock while `fn` is still running. Another instance can then start the same
 *     job and the two overlap (jobs are idempotent by design, so this is safe but wasteful). `runExclusive`
 *     may also reject with a transaction-timeout error AFTER `fn` has already finished its work, so a caller
 *     can log a lock failure for a job that actually completed. Behaviour is intentionally unchanged.
 *  3. The Prisma pool default max is 10 connections; worst case three jobs hold a parked connection each
 *     (schedule sweep, reconcile, retention), leaving 7 for the app.
 */
@Injectable()
export class PgAdvisoryJobLock implements ReportJobLock {
  constructor(private readonly prisma: PrismaService) {}

  async runExclusive<T>(
    jobName: string,
    fn: () => Promise<T>,
  ): Promise<LockedRun<T>> {
    const key = `reports:${jobName}`;
    return this.prisma.$transaction(
      async (tx): Promise<LockedRun<T>> => {
        const rows = await tx.$queryRaw<
          Array<{ locked: boolean }>
        >`SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS locked`;
        if (!rows[0]?.locked) return { acquired: false };
        return { acquired: true, value: await fn() };
      },
      { timeout: LOCK_TX_TIMEOUT_MS, maxWait: LOCK_TX_MAX_WAIT_MS },
    );
  }
}
