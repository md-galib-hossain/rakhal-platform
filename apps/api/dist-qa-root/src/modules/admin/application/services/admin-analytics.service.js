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
exports.AdminAnalyticsService = exports.EXPORT_ROW_LIMIT = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const csv_1 = require("../../domain/csv");
const admin_audit_service_1 = require("./admin-audit.service");
const DAY_MS = 24 * 60 * 60 * 1000;
exports.EXPORT_ROW_LIMIT = 10_000;
let AdminAnalyticsService = class AdminAnalyticsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async usage() {
        const now = new Date();
        const since = (days) => new Date(now.getTime() - days * DAY_MS);
        const [byPlan, mrr, revenue, active7, active30, expiring] = await Promise.all([
            this.prisma.$queryRaw `
        SELECT p.name AS plan, s.status::text AS status, count(*) AS n
        FROM (
          SELECT DISTINCT ON ("farmId") "subscriptionPlanId", status
          FROM "FarmSubscription"
          ORDER BY "farmId", "createdAt" DESC
        ) s
        JOIN "SubscriptionPlan" p ON p.id = s."subscriptionPlanId"
        GROUP BY 1, 2
        ORDER BY 1, 2`,
            this.prisma.$queryRaw `
        SELECT sum(p."monthlyPrice")::text AS total
        FROM (
          SELECT DISTINCT ON ("farmId") "subscriptionPlanId", status
          FROM "FarmSubscription"
          ORDER BY "farmId", "createdAt" DESC
        ) s
        JOIN "SubscriptionPlan" p ON p.id = s."subscriptionPlanId"
        WHERE s.status = 'ACTIVE'`,
            this.prisma.invoice.aggregate({
                where: { status: 'PAID', createdAt: { gte: since(30) } },
                _sum: { total: true },
                _count: { _all: true },
            }),
            this.activeFarms(since(7)),
            this.activeFarms(since(30)),
            this.prisma.$queryRaw `
        SELECT s."farmId", f.name AS farm, p.name AS plan, s.status::text AS status, s."expiresAt"
        FROM (
          SELECT DISTINCT ON ("farmId") *
          FROM "FarmSubscription"
          ORDER BY "farmId", "createdAt" DESC
        ) s
        JOIN "Farm" f ON f.id = s."farmId" AND f."deletedAt" IS NULL
        JOIN "SubscriptionPlan" p ON p.id = s."subscriptionPlanId"
        WHERE s.status IN ('ACTIVE', 'TRIALING')
          AND s."expiresAt" IS NOT NULL
          AND s."expiresAt" BETWEEN ${now} AND ${new Date(now.getTime() + 14 * DAY_MS)}
        ORDER BY s."expiresAt" ASC
        LIMIT 25`,
        ]);
        const plans = new Map();
        for (const row of byPlan) {
            plans.set(row.plan, {
                ...(plans.get(row.plan) ?? {}),
                [row.status]: Number(row.n),
            });
        }
        return {
            generatedAt: now.toISOString(),
            subscriptions: {
                byPlan: [...plans].map(([plan, counts]) => ({ plan, counts })),
            },
            mrr: { listPriceBdt: Number(mrr[0]?.total ?? 0) },
            revenue: {
                windowDays: 30,
                paidInvoices: revenue._count._all,
                totalBdt: Number(revenue._sum.total ?? 0),
            },
            activeFarms: { last7Days: active7, last30Days: active30 },
            expiring: expiring.map((e) => ({
                farmId: e.farmId,
                farm: e.farm,
                plan: e.plan,
                status: e.status,
                expiresAt: e.expiresAt,
            })),
        };
    }
    async activeFarms(since) {
        const rows = await this.prisma.$queryRaw `
      SELECT count(DISTINCT fm."farmId") AS n
      FROM "FarmMember" fm
      JOIN "Session" s ON s."userId" = fm."userId"
      JOIN "Farm" f ON f.id = fm."farmId" AND f."deletedAt" IS NULL
      WHERE s."lastUsedAt" >= ${since}`;
        return Number(rows[0]?.n ?? 0);
    }
    async export(actorId, kind) {
        const { headers, rows } = await this.collect(kind);
        const stamp = new Date().toISOString().slice(0, 10);
        await this.audit.record({
            adminId: actorId,
            action: 'EXPORT_GENERATED',
            entityType: 'Export',
            entityId: kind,
            metadata: {
                kind,
                rows: rows.length,
                truncated: rows.length >= exports.EXPORT_ROW_LIMIT,
            },
        });
        return {
            filename: `rakhal-${kind}-${stamp}.csv`,
            csv: (0, csv_1.toCsv)(headers, rows),
            rows: rows.length,
        };
    }
    async collect(kind) {
        if (kind === 'users') {
            const users = await this.prisma.user.findMany({
                where: { deletedAt: null },
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                take: exports.EXPORT_ROW_LIMIT,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    isEmailVerified: true,
                    isBlocked: true,
                    lastLoginAt: true,
                    createdAt: true,
                },
            });
            return {
                headers: [
                    'id',
                    'name',
                    'email',
                    'email_verified',
                    'blocked',
                    'last_login_at',
                    'created_at',
                ],
                rows: users.map((u) => [
                    u.id,
                    u.name,
                    u.email,
                    u.isEmailVerified,
                    u.isBlocked,
                    u.lastLoginAt,
                    u.createdAt,
                ]),
            };
        }
        const farms = await this.prisma.farm.findMany({
            where: { deletedAt: null },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: exports.EXPORT_ROW_LIMIT,
            select: {
                id: true,
                name: true,
                farmCode: true,
                status: true,
                division: true,
                district: true,
                createdAt: true,
                owner: { select: { email: true } },
                _count: { select: { members: true } },
                subscriptions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        status: true,
                        startsAt: true,
                        expiresAt: true,
                        cancelledAt: true,
                        subscriptionPlan: { select: { name: true } },
                    },
                },
            },
        });
        if (kind === 'subscriptions') {
            return {
                headers: [
                    'farm_id',
                    'farm',
                    'plan',
                    'status',
                    'starts_at',
                    'expires_at',
                    'cancelled_at',
                ],
                rows: farms.map((f) => {
                    const s = f.subscriptions[0];
                    return [
                        f.id,
                        f.name,
                        s?.subscriptionPlan.name,
                        s?.status,
                        s?.startsAt,
                        s?.expiresAt,
                        s?.cancelledAt,
                    ];
                }),
            };
        }
        return {
            headers: [
                'id',
                'name',
                'farm_code',
                'status',
                'division',
                'district',
                'owner_email',
                'plan',
                'subscription_status',
                'expires_at',
                'members',
                'created_at',
            ],
            rows: farms.map((f) => {
                const s = f.subscriptions[0];
                return [
                    f.id,
                    f.name,
                    f.farmCode,
                    f.status,
                    f.division,
                    f.district,
                    f.owner.email,
                    s?.subscriptionPlan.name,
                    s?.status,
                    s?.expiresAt,
                    f._count.members,
                    f.createdAt,
                ];
            }),
        };
    }
};
exports.AdminAnalyticsService = AdminAnalyticsService;
exports.AdminAnalyticsService = AdminAnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        admin_audit_service_1.AdminAuditService])
], AdminAnalyticsService);
//# sourceMappingURL=admin-analytics.service.js.map