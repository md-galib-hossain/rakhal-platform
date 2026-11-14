import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';

/**
 * RD-012(a) — reconstruct each cow's AQR score as of `asOf`, with no new snapshot storage.
 * `ActivityLog` is already immutable + hash-chained (permanent by design), and every
 * AQR-affecting event already records `previousAqrScore` (`AqrService.applyEvent`). For a given
 * cow, the score in effect at `asOf` is the `previousAqrScore` of the *earliest* AQR event that
 * happened *after* `asOf` — that field is, by construction, "whatever the score was immediately
 * before this event," which covers the whole span back to the prior event (or to `asOf`, since
 * nothing changed in between). If no AQR event happened after `asOf` at all, nothing has changed
 * the score since then, so the cow's *current* `aqrScore` (passed in, not re-queried) already IS
 * the value as of `asOf` — used as the fallback for every cow the raw query doesn't return a row
 * for. One batched query regardless of herd size (`DISTINCT ON`, same `$queryRaw`/`Prisma.sql`
 * convention as `ReproductionService.lockCattleForUpdate`).
 *
 * Plain exported function, not a service method — mirrors `computeCattleFinance`'s convention
 * (`cattle-finance-aggregation.ts`) so both `CattleService.highlights()` (herd-level) and
 * `CattleDetailService.overview()` (per-cow, the *live* `GET /cattle/:id/overview` handler) can
 * call the same logic directly without a cross-service DI edge for one helper.
 */
export async function computeAqrScoreAsOf(
  prisma: PrismaService,
  farmId: string,
  cattle: { id: string; aqrScore: number | null }[],
  asOf: Date,
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  for (const c of cattle) result.set(c.id, c.aqrScore);
  if (cattle.length === 0) return result;

  const rows = await prisma.$queryRaw<
    { cattleId: string; previousAqrScore: number }[]
  >(
    Prisma.sql`
      SELECT DISTINCT ON ("relatedCattleId") "relatedCattleId" AS "cattleId", "previousAqrScore"
      FROM "ActivityLog"
      WHERE "farmId" = ${farmId}
        AND "relatedCattleId" IN (${Prisma.join(cattle.map((c) => c.id))})
        AND "aqrImpact" IS NOT NULL
        AND "previousAqrScore" IS NOT NULL
        AND "timestamp" > ${asOf}
      ORDER BY "relatedCattleId", "timestamp" ASC
    `,
  );
  for (const row of rows) result.set(row.cattleId, row.previousAqrScore);
  return result;
}
