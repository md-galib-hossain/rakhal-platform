"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminInsightsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const DAY_MS = 24 * 60 * 60 * 1000;
const SERIES_DAYS = 30;
function pct(a, b) {
    return b > 0 ? Math.round((a / b) * 1000) / 10 : null;
}
const n = (rows) => Number(rows[0]?.n ?? 0);
let AdminInsightsService = class AdminInsightsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async engagement() {
        const now = new Date();
        const since = (days) => new Date(now.getTime() - days * DAY_MS);
        const seriesFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (SERIES_DAYS - 1)));
        const [dau, wau, mau, returning, dormant, usersTotal, cohort90, activated90, d7Base, d7Kept, d30Base, d30Kept, farmsTotal, farmsWithRecords30, farmsEverRecorded, cattle, byModule, medianHours, series, geoFarms, geoUnknown,] = await Promise.all([
            this.activeUsers(since(1)),
            this.activeUsers(since(7)),
            this.activeUsers(since(30)),
            this.prisma.$queryRaw `
        SELECT count(DISTINCT u.id) AS n FROM "User" u
        JOIN "Session" s ON s."userId" = u.id
        WHERE u."deletedAt" IS NULL AND s."lastUsedAt" >= ${since(7)} AND u."createdAt" < ${since(7)}`,
            this.prisma.$queryRaw `
        SELECT count(*) AS n FROM "User" u
        WHERE u."deletedAt" IS NULL AND u."isBlocked" = false AND u."createdAt" < ${since(30)}
          AND NOT EXISTS (SELECT 1 FROM "Session" s WHERE s."userId" = u.id AND s."lastUsedAt" >= ${since(30)})`,
            this.prisma.user.count({ where: { deletedAt: null } }),
            this.prisma.user.count({
                where: { deletedAt: null, createdAt: { gte: since(90) } },
            }),
            this.prisma.$queryRaw `
        SELECT count(DISTINCT u.id) AS n FROM "User" u
        JOIN "FarmMember" fm ON fm."userId" = u.id
        JOIN "Farm" f ON f.id = fm."farmId" AND f."deletedAt" IS NULL
        WHERE u."deletedAt" IS NULL AND u."createdAt" >= ${since(90)}
          AND (EXISTS (SELECT 1 FROM "ActivityLog" a WHERE a."farmId" = f.id)
            OR EXISTS (SELECT 1 FROM "Cattle" c WHERE c."farmId" = f.id AND c."deletedAt" IS NULL))`,
            this.prisma.user.count({
                where: {
                    deletedAt: null,
                    createdAt: { gte: since(60), lt: since(7) },
                },
            }),
            this.retained(7, since(60), since(7)),
            this.prisma.user.count({
                where: {
                    deletedAt: null,
                    createdAt: { gte: since(120), lt: since(30) },
                },
            }),
            this.retained(30, since(120), since(30)),
            this.prisma.farm.count({ where: { deletedAt: null } }),
            this.prisma.$queryRaw `
        SELECT count(DISTINCT a."farmId") AS n FROM "ActivityLog" a
        JOIN "Farm" f ON f.id = a."farmId" AND f."deletedAt" IS NULL
        WHERE a."timestamp" >= ${since(30)}`,
            this.prisma.$queryRaw `
        SELECT count(DISTINCT a."farmId") AS n FROM "ActivityLog" a
        JOIN "Farm" f ON f.id = a."farmId" AND f."deletedAt" IS NULL`,
            this.prisma.$queryRaw `
        SELECT count(*) AS n FROM "Cattle" c
        JOIN "Farm" f ON f.id = c."farmId" AND f."deletedAt" IS NULL
        WHERE c."deletedAt" IS NULL`,
            this.prisma.$queryRaw `
        SELECT a.module::text AS module, count(DISTINCT a."farmId") AS farms, count(*) AS records
        FROM "ActivityLog" a
        JOIN "Farm" f ON f.id = a."farmId" AND f."deletedAt" IS NULL
        WHERE a."timestamp" >= ${since(30)}
        GROUP BY 1`,
            this.prisma.$queryRaw `
        SELECT percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (fa.first_at - f."createdAt")) / 3600.0) AS hours
        FROM "Farm" f
        JOIN (SELECT "farmId", min("timestamp") AS first_at FROM "ActivityLog" GROUP BY 1) fa
          ON fa."farmId" = f.id
        WHERE f."deletedAt" IS NULL AND fa.first_at >= f."createdAt"`,
            this.prisma.$queryRaw `
        SELECT date_trunc('day', s."lastUsedAt" AT TIME ZONE 'UTC')::date AS day, count(DISTINCT s."userId") AS n
        FROM "Session" s JOIN "User" u ON u.id = s."userId" AND u."deletedAt" IS NULL
        WHERE s."lastUsedAt" >= ${seriesFrom}
        GROUP BY 1 ORDER BY 1`,
            this.prisma.$queryRaw `
        SELECT f.division, f.district, count(DISTINCT f.id) AS farms,
               count(c.id) FILTER (WHERE c."deletedAt" IS NULL) AS cattle
        FROM "Farm" f LEFT JOIN "Cattle" c ON c."farmId" = f.id
        WHERE f."deletedAt" IS NULL
        GROUP BY 1, 2`,
            this.prisma.farm.count({
                where: { deletedAt: null, division: null, district: null },
            }),
        ]);
        const modules = byModule
            .map((m) => ({
            module: m.module,
            farms: Number(m.farms),
            records: Number(m.records),
            shareOfActiveFarms: pct(Number(m.farms), n(farmsWithRecords30)),
        }))
            .sort((a, b) => b.farms - a.farms || b.records - a.records);
        return {
            generatedAt: now.toISOString(),
            users: {
                total: usersTotal,
                active: { daily: n(dau), weekly: n(wau), monthly: n(mau) },
                stickiness: pct(n(dau), n(mau)),
                returning: n(returning),
                dormant: n(dormant),
            },
            activation: {
                windowDays: 90,
                signedUp: cohort90,
                activated: n(activated90),
                rate: pct(n(activated90), cohort90),
                neverActivated: Math.max(0, cohort90 - n(activated90)),
                medianHoursToFirstRecord: medianHours[0]?.hours != null
                    ? Math.round(medianHours[0].hours * 10) / 10
                    : null,
            },
            retention: {
                d7: { base: d7Base, kept: d7Kept, rate: pct(d7Kept, d7Base) },
                d30: { base: d30Base, kept: d30Kept, rate: pct(d30Kept, d30Base) },
            },
            farms: {
                total: farmsTotal,
                withRecordsLast30Days: n(farmsWithRecords30),
                everRecorded: n(farmsEverRecorded),
                shareWithRecordsLast30Days: pct(n(farmsWithRecords30), farmsTotal),
            },
            records: {
                cattleTracked: n(cattle),
                last30Days: modules.reduce((a, m) => a + m.records, 0),
            },
            modules,
            dailyActiveUsers: this.fillDays(series, seriesFrom),
            geography: this.geography(geoFarms, geoUnknown),
        };
    }
    activeUsers(since) {
        return this.prisma.$queryRaw `
      SELECT count(DISTINCT s."userId") AS n
      FROM "Session" s JOIN "User" u ON u.id = s."userId" AND u."deletedAt" IS NULL
      WHERE s."lastUsedAt" >= ${since}`;
    }
    async retained(days, from, to) {
        const rows = await this.prisma.$queryRaw `
      SELECT count(DISTINCT u.id) AS n FROM "User" u
      JOIN "Session" s ON s."userId" = u.id
      WHERE u."deletedAt" IS NULL AND u."createdAt" >= ${from} AND u."createdAt" < ${to}
        AND s."lastUsedAt" >= u."createdAt" + make_interval(days => ${days})`;
        return n(rows);
    }
    fillDays(rows, from) {
        const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.n)]));
        return Array.from({ length: SERIES_DAYS }, (_, i) => {
            const day = new Date(from.getTime() + i * DAY_MS)
                .toISOString()
                .slice(0, 10);
            return { day, count: byDay.get(day) ?? 0 };
        });
    }
    geography(rows, unspecified) {
        const divisions = new Map();
        const districts = [];
        for (const r of rows) {
            if (!r.division && !r.district)
                continue;
            const key = r.division ?? 'Division not provided';
            const d = divisions.get(key) ?? { farms: 0, cattle: 0 };
            d.farms += Number(r.farms);
            d.cattle += Number(r.cattle);
            divisions.set(key, d);
            if (r.district) {
                districts.push({
                    division: r.division,
                    district: r.district,
                    farms: Number(r.farms),
                });
            }
        }
        return {
            unspecifiedFarms: unspecified,
            divisions: [...divisions]
                .map(([name, v]) => ({ name, ...v }))
                .sort((a, b) => b.farms - a.farms),
            districts: districts.sort((a, b) => b.farms - a.farms).slice(0, 15),
        };
    }
    async security() {
        const now = new Date();
        const since = (h) => new Date(now.getTime() - h * 3_600_000);
        const [activeSessions, signIns24h, signIns7d, failing24h, lockedNow, blocked, adminFailed24h, recent, attention, multiLocation, adminFailures,] = await Promise.all([
            this.prisma.session.count({
                where: { status: 'ACTIVE', expiresAt: { gt: now } },
            }),
            this.prisma.session.count({ where: { createdAt: { gte: since(24) } } }),
            this.prisma.session.count({ where: { createdAt: { gte: since(168) } } }),
            this.prisma.user.count({
                where: {
                    deletedAt: null,
                    failedLoginAttempts: { gt: 0 },
                    lastFailedLoginAt: { gte: since(24) },
                },
            }),
            this.prisma.user.count({
                where: { deletedAt: null, lockedUntil: { gt: now } },
            }),
            this.prisma.user.count({ where: { deletedAt: null, isBlocked: true } }),
            this.prisma.platformAdminAuditLog.count({
                where: { action: 'LOGIN_FAILED', createdAt: { gte: since(24) } },
            }),
            this.prisma.session.findMany({
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                take: 25,
                select: {
                    id: true,
                    status: true,
                    ipAddress: true,
                    userAgent: true,
                    deviceName: true,
                    createdAt: true,
                    lastUsedAt: true,
                    user: { select: { id: true, name: true, email: true } },
                },
            }),
            this.prisma.user.findMany({
                where: {
                    deletedAt: null,
                    OR: [
                        { failedLoginAttempts: { gte: 3 } },
                        { lockedUntil: { gt: now } },
                    ],
                },
                orderBy: [{ lastFailedLoginAt: { sort: 'desc', nulls: 'last' } }],
                take: 25,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    isBlocked: true,
                    failedLoginAttempts: true,
                    lastFailedLoginAt: true,
                    lockedUntil: true,
                },
            }),
            this.prisma.$queryRaw `
        SELECT u.id, u.name, u.email, count(DISTINCT s."ipAddress") AS ips
        FROM "Session" s JOIN "User" u ON u.id = s."userId" AND u."deletedAt" IS NULL
        WHERE s."createdAt" >= ${since(24)} AND s."ipAddress" IS NOT NULL
        GROUP BY u.id HAVING count(DISTINCT s."ipAddress") >= 3
        ORDER BY ips DESC LIMIT 10`,
            this.prisma.platformAdminAuditLog.findMany({
                where: { action: 'LOGIN_FAILED' },
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                take: 10,
                select: {
                    id: true,
                    actorEmail: true,
                    ipAddress: true,
                    createdAt: true,
                },
            }),
        ]);
        return {
            generatedAt: now.toISOString(),
            counts: {
                activeSessions,
                signIns24h,
                signIns7d,
                usersWithFailedAttempts24h: failing24h,
                lockedNow,
                blocked,
                adminFailedLogins24h: adminFailed24h,
            },
            recentSignIns: recent,
            needsAttention: attention,
            multiLocation: multiLocation.map((m) => ({
                id: m.id,
                name: m.name,
                email: m.email,
                distinctIps: Number(m.ips),
            })),
            adminFailedLogins: adminFailures,
        };
    }
};
exports.AdminInsightsService = AdminInsightsService;
exports.AdminInsightsService = AdminInsightsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminInsightsService);
//# sourceMappingURL=admin-insights.service.js.map