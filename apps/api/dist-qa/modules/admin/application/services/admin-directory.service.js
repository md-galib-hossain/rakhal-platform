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
exports.AdminDirectoryService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const pagination_1 = require("src/common/pagination");
const DAY_MS = 24 * 60 * 60 * 1000;
const SERIES_DAYS = 30;
const LATEST_SUBSCRIPTION = {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
        status: true,
        startsAt: true,
        expiresAt: true,
        cancelledAt: true,
        subscriptionPlan: { select: { id: true, name: true } },
        pendingPlan: { select: { id: true, name: true } },
    },
};
const contains = (x) => ({
    contains: x,
    mode: 'insensitive',
});
let AdminDirectoryService = class AdminDirectoryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listFarms(query) {
        const search = query.search;
        const where = {
            deletedAt: null,
            ...(query.status ? { status: query.status } : {}),
            ...(search
                ? {
                    OR: [
                        { name: contains(search) },
                        { slug: contains(search) },
                        { farmCode: contains(search) },
                        { phone: contains(search) },
                        { owner: { email: contains(search) } },
                        { owner: { name: contains(search) } },
                    ],
                }
                : {}),
        };
        const rows = await this.prisma.farm.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            select: {
                id: true,
                name: true,
                farmCode: true,
                status: true,
                division: true,
                district: true,
                createdAt: true,
                owner: { select: { id: true, name: true, email: true } },
                _count: {
                    select: {
                        members: true,
                        cattle: { where: { deletedAt: null } },
                    },
                },
                subscriptions: LATEST_SUBSCRIPTION,
            },
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        return {
            ...page,
            items: page.items.map(({ subscriptions, _count, ...farm }) => ({
                ...farm,
                memberCount: _count.members,
                cattleCount: _count.cattle,
                subscription: subscriptions[0] ?? null,
            })),
        };
    }
    async getFarm(id) {
        const farm = await this.prisma.farm.findFirst({
            where: { id, deletedAt: null },
            select: {
                id: true,
                name: true,
                slug: true,
                farmCode: true,
                status: true,
                description: true,
                phone: true,
                address: true,
                division: true,
                district: true,
                upazila: true,
                operationalPurpose: true,
                herdSizeBand: true,
                timezone: true,
                hasCompletedOnboarding: true,
                createdAt: true,
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        isEmailVerified: true,
                        isBlocked: true,
                        lastLoginAt: true,
                    },
                },
                members: {
                    orderBy: { joinedAt: 'asc' },
                    select: {
                        joinedAt: true,
                        role: { select: { name: true } },
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                isBlocked: true,
                                lastLoginAt: true,
                            },
                        },
                    },
                },
                subscriptions: { ...LATEST_SUBSCRIPTION, take: 3 },
                _count: { select: { cattle: true } },
            },
        });
        if (!farm)
            throw new common_1.NotFoundException('Farm not found');
        const lastSeen = await this.prisma.session.aggregate({
            where: { user: { farmMembers: { some: { farmId: id } } } },
            _max: { lastUsedAt: true },
        });
        const { _count, subscriptions, members, ...rest } = farm;
        return {
            ...rest,
            cattleRecords: _count.cattle,
            lastActivityAt: lastSeen._max.lastUsedAt,
            subscription: subscriptions[0] ?? null,
            subscriptionHistory: subscriptions,
            members: members.map((m) => ({
                joinedAt: m.joinedAt,
                role: m.role.name,
                ...m.user,
            })),
        };
    }
    async listUsers(query) {
        const search = query.search;
        const rows = await this.prisma.user.findMany({
            where: {
                deletedAt: null,
                ...(search
                    ? { OR: [{ email: contains(search) }, { name: contains(search) }] }
                    : {}),
            },
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
            select: {
                id: true,
                name: true,
                email: true,
                isEmailVerified: true,
                isBlocked: true,
                lockedUntil: true,
                lastLoginAt: true,
                createdAt: true,
                _count: { select: { farmMembers: true, ownedFarms: true } },
                sessions: {
                    orderBy: { lastUsedAt: { sort: 'desc', nulls: 'last' } },
                    take: 1,
                    select: { lastUsedAt: true },
                },
            },
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        return {
            ...page,
            items: page.items.map(({ _count, sessions, ...user }) => ({
                ...user,
                farmCount: _count.farmMembers,
                ownedFarmCount: _count.ownedFarms,
                lastActiveAt: sessions[0]?.lastUsedAt ?? null,
            })),
        };
    }
    async getUser(id) {
        const user = await this.prisma.user.findFirst({
            where: { id, deletedAt: null },
            select: {
                id: true,
                name: true,
                email: true,
                isEmailVerified: true,
                emailVerifiedAt: true,
                isBlocked: true,
                lockedUntil: true,
                failedLoginAttempts: true,
                lastFailedLoginAt: true,
                lastLoginAt: true,
                lastPasswordChangedAt: true,
                preferredLanguage: true,
                createdAt: true,
                mfa: { select: { id: true } },
                farmMembers: {
                    orderBy: { joinedAt: 'asc' },
                    select: {
                        joinedAt: true,
                        role: { select: { name: true } },
                        farm: { select: { id: true, name: true, status: true } },
                    },
                },
                _count: { select: { ownedFarms: true } },
            },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const activeSessions = await this.prisma.session.count({
            where: { userId: id, status: 'ACTIVE', expiresAt: { gt: new Date() } },
        });
        const connectedChannels = await this.prisma.deviceToken.findMany({
            where: { userId: id },
            select: {
                id: true,
                provider: true,
                platform: true,
                token: true,
                createdAt: true,
                lastSeenAt: true,
            },
        });
        const recentSessions = await this.prisma.session.findMany({
            where: { userId: id },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 20,
            select: {
                id: true,
                status: true,
                ipAddress: true,
                userAgent: true,
                deviceName: true,
                createdAt: true,
                lastUsedAt: true,
                expiresAt: true,
            },
        });
        const { mfa, farmMembers, _count, ...rest } = user;
        return {
            ...rest,
            recentSessions,
            connectedChannels: connectedChannels.map((c) => ({
                id: c.id,
                provider: c.provider,
                platform: c.platform,
                createdAt: c.createdAt,
                lastSeenAt: c.lastSeenAt,
            })),
            hasTelegram: connectedChannels.some((c) => c.provider === 'telegram'),
            hasPush: connectedChannels.some((c) => c.provider === 'fcm'),
            mfaConfigured: mfa !== null,
            ownedFarmCount: _count.ownedFarms,
            activeSessionCount: activeSessions,
            memberships: farmMembers.map((m) => ({
                joinedAt: m.joinedAt,
                role: m.role.name,
                farm: m.farm,
            })),
        };
    }
    async overview() {
        const now = new Date();
        const since = (days) => new Date(now.getTime() - days * DAY_MS);
        const seriesFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (SERIES_DAYS - 1)));
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const [farmsByStatus, usersTotal, usersBlocked, farms7, farms30, users7, users30, subs, farmSeries, userSeries, farmsMonth, usersMonth, dau, mau,] = await Promise.all([
            this.prisma.farm.groupBy({
                by: ['status'],
                where: { deletedAt: null },
                _count: { _all: true },
            }),
            this.prisma.user.count({ where: { deletedAt: null } }),
            this.prisma.user.count({ where: { deletedAt: null, isBlocked: true } }),
            this.prisma.farm.count({
                where: { deletedAt: null, createdAt: { gte: since(7) } },
            }),
            this.prisma.farm.count({
                where: { deletedAt: null, createdAt: { gte: since(30) } },
            }),
            this.prisma.user.count({
                where: { deletedAt: null, createdAt: { gte: since(7) } },
            }),
            this.prisma.user.count({
                where: { deletedAt: null, createdAt: { gte: since(30) } },
            }),
            this.prisma.$queryRaw `
        SELECT status::text AS status, count(*) AS n
        FROM (
          SELECT DISTINCT ON ("farmId") status
          FROM "FarmSubscription"
          ORDER BY "farmId", "createdAt" DESC
        ) latest
        GROUP BY status`,
            this.dailySeries('Farm', seriesFrom),
            this.dailySeries('User', seriesFrom),
            this.prisma.farm.count({
                where: { deletedAt: null, createdAt: { gte: monthStart } },
            }),
            this.prisma.user.count({
                where: { deletedAt: null, createdAt: { gte: monthStart } },
            }),
            this.activeUsers(since(1)),
            this.activeUsers(since(30)),
        ]);
        const farmCounts = {
            ACTIVE: 0,
            SUSPENDED: 0,
            ARCHIVED: 0,
        };
        for (const row of farmsByStatus)
            farmCounts[row.status] = row._count._all;
        return {
            generatedAt: now.toISOString(),
            farms: {
                total: Object.values(farmCounts).reduce((a, b) => a + b, 0),
                byStatus: farmCounts,
                newLast7Days: farms7,
                newLast30Days: farms30,
                newThisMonth: farmsMonth,
            },
            users: {
                total: usersTotal,
                blocked: usersBlocked,
                newLast7Days: users7,
                newLast30Days: users30,
                newThisMonth: usersMonth,
                activeLastDay: dau,
                activeLast30Days: mau,
            },
            subscriptions: {
                byStatus: Object.fromEntries(subs.map((s) => [s.status, Number(s.n)])),
            },
            signups: {
                days: SERIES_DAYS,
                farms: this.fillDays(farmSeries, seriesFrom),
                users: this.fillDays(userSeries, seriesFrom),
            },
        };
    }
    async activeUsers(since) {
        const rows = await this.prisma.$queryRaw `
      SELECT count(DISTINCT s."userId") AS n
      FROM "Session" s JOIN "User" u ON u.id = s."userId" AND u."deletedAt" IS NULL
      WHERE s."lastUsedAt" >= ${since}`;
        return Number(rows[0]?.n ?? 0);
    }
    async dailySeries(table, from) {
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC')::date AS day, count(*) AS n
        FROM ${client_1.Prisma.raw(`"${table}"`)}
        WHERE "createdAt" >= ${from} AND "deletedAt" IS NULL
        GROUP BY 1 ORDER BY 1`);
        return rows.map((r) => ({
            day: r.day.toISOString().slice(0, 10),
            count: Number(r.n),
        }));
    }
    fillDays(rows, from) {
        const byDay = new Map(rows.map((r) => [r.day, r.count]));
        return Array.from({ length: SERIES_DAYS }, (_, i) => {
            const day = new Date(from.getTime() + i * DAY_MS)
                .toISOString()
                .slice(0, 10);
            return { day, count: byDay.get(day) ?? 0 };
        });
    }
};
exports.AdminDirectoryService = AdminDirectoryService;
exports.AdminDirectoryService = AdminDirectoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminDirectoryService);
//# sourceMappingURL=admin-directory.service.js.map