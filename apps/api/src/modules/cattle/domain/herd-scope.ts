/**
 * Pure Prisma `where`-fragment helpers for the herd-membership/soft-delete
 * split (RAKHAL-397/398, ADR-024). `herdStatus` and `deletedAt` are two
 * independent dimensions — these three functions are the only sanctioned
 * spellings of "which rows" for a given intent, so every call site states
 * its intent instead of repeating the same inline literal.
 *
 * No Prisma middleware / client extension by design — RAKHAL-310 already
 * documents ~10 deliberate exceptions (`getCattleOrThrow`, pedigree counts,
 * `bulk('export')`, report aggregation, AQR lookups) that need every row
 * regardless of status. A global default filter would silently break each
 * one; explicit helpers keep every exception visible and greppable via
 * `anyRecord`.
 */

import { HerdStatus, Prisma } from '@prisma/client';

/** Rows in the active herd: `herdStatus=ACTIVE` and not soft-deleted. Use for
 * every day-to-day workflow read (milk, feeding, reproduction tasks, health
 * alerts, active herd counts) and for any write that must target a live
 * animal. */
export const activeHerd = (farmId: string): Prisma.CattleWhereInput => ({
  farmId,
  herdStatus: HerdStatus.ACTIVE,
  deletedAt: null,
});

/** Rows not soft-deleted, regardless of herd status — includes SOLD/CULLED/
 * DECEASED. Use for historical reads: pedigree, reports, past-record
 * lookups where a sold or dead animal must still appear. */
export const notDeleted = (farmId: string): Prisma.CattleWhereInput => ({
  farmId,
  deletedAt: null,
});

/** Every row for the farm, deleted or not. Use only at the documented
 * RAKHAL-310 exception sites (see file header) — always leave the existing
 * comment explaining why the record must be reachable even when deleted. */
export const anyRecord = (farmId: string): Prisma.CattleWhereInput => ({
  farmId,
});
