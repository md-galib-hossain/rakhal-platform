"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeAqrScoreAsOf = computeAqrScoreAsOf;
const client_1 = require("@prisma/client");
async function computeAqrScoreAsOf(prisma, farmId, cattle, asOf) {
    const result = new Map();
    for (const c of cattle)
        result.set(c.id, c.aqrScore);
    if (cattle.length === 0)
        return result;
    const rows = await prisma.$queryRaw(client_1.Prisma.sql `
      SELECT DISTINCT ON ("relatedCattleId") "relatedCattleId" AS "cattleId", "previousAqrScore"
      FROM "ActivityLog"
      WHERE "farmId" = ${farmId}
        AND "relatedCattleId" IN (${client_1.Prisma.join(cattle.map((c) => c.id))})
        AND "aqrImpact" IS NOT NULL
        AND "previousAqrScore" IS NOT NULL
        AND "timestamp" > ${asOf}
      ORDER BY "relatedCattleId", "timestamp" ASC
    `);
    for (const row of rows)
        result.set(row.cattleId, row.previousAqrScore);
    return result;
}
//# sourceMappingURL=aqr-trend.js.map