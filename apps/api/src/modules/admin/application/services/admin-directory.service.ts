import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import {
  ListAdminFarmsQueryDto,
  ListAdminUsersQueryDto,
} from '../../presentation/dto/admin-directory.dto';

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
} satisfies Prisma.Farm$subscriptionsArgs;

/** `x` in a case-insensitive "contains" filter. */
const contains = (x: string) => ({
  contains: x,
  mode: 'insensitive' as const,
});

export interface DayCount {
  /** UTC calendar day, `YYYY-MM-DD`. */
  day: string;
  count: number;
}

/**
 * Read-only platform directory for support (Phase 3): find a farm or user, see
 * their account state, and read a handful of platform metrics. Nothing here
 * writes, and no credential-like field (password hash, MFA secret, tokens) is
 * ever selected. Soft-deleted rows are excluded.
 */
@Injectable()
export class AdminDirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- farms

  async listFarms(query: ListAdminFarmsQueryDto) {
    const search = query.search;
    const where: Prisma.FarmWhereInput = {
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
      ...getCursorArgs(query),
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

    const page = toCursorPage(rows, query);
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

  async getFarm(id: string) {
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
    if (!farm) throw new NotFoundException('Farm not found');

    // "Last activity" = the most recent time any member's session was used.
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

  // ---------------------------------------------------------------- users

  async listUsers(query: ListAdminUsersQueryDto) {
    const search = query.search;
    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(search
          ? { OR: [{ email: contains(search) }, { name: contains(search) }] }
          : {}),
      },
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
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

    const page = toCursorPage(rows, query);
    return {
      ...page,
      items: page.items.map(({ _count, sessions, ...user }) => ({
        ...user,
        farmCount: _count.farmMembers,
        ownedFarmCount: _count.ownedFarms,
        /** Most recent time any of the user's sessions was used (null = never). */
        lastActiveAt: sessions[0]?.lastUsedAt ?? null,
      })),
    };
  }

  async getUser(id: string) {
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
    if (!user) throw new NotFoundException('User not found');

    const activeSessions = await this.prisma.session.count({
      where: { userId: id, status: 'ACTIVE', expiresAt: { gt: new Date() } },
    });

    // Sign-in history: IP, device and timing only. Token/refresh material is never selected.
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

  // ------------------------------------------------------------- overview

  /**
   * Platform counters. Definitions (so the numbers are auditable):
   * - farms/users: rows not soft-deleted; "new" = `createdAt` within the window.
   * - subscriptions: each farm counted once, by its *latest* `FarmSubscription` row.
   * - series: per-UTC-day signups for the last {@link SERIES_DAYS} days, zero-filled.
   */
  async overview() {
    const now = new Date();
    const since = (days: number) => new Date(now.getTime() - days * DAY_MS);
    const seriesFrom = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - (SERIES_DAYS - 1),
      ),
    );
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const [
      farmsByStatus,
      usersTotal,
      usersBlocked,
      farms7,
      farms30,
      users7,
      users30,
      subs,
      farmSeries,
      userSeries,
      farmsMonth,
      usersMonth,
      dau,
      mau,
    ] = await Promise.all([
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
      this.prisma.$queryRaw<{ status: string; n: bigint }[]>`
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

    const farmCounts: Record<string, number> = {
      ACTIVE: 0,
      SUSPENDED: 0,
      ARCHIVED: 0,
    };
    for (const row of farmsByStatus) farmCounts[row.status] = row._count._all;

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
        /** Distinct users whose session was used in the last 24 h / 30 days (see AdminInsightsService). */
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

  private async activeUsers(since: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(DISTINCT s."userId") AS n
      FROM "Session" s JOIN "User" u ON u.id = s."userId" AND u."deletedAt" IS NULL
      WHERE s."lastUsedAt" >= ${since}`;
    return Number(rows[0]?.n ?? 0);
  }

  private async dailySeries(
    table: 'Farm' | 'User',
    from: Date,
  ): Promise<DayCount[]> {
    // `table` is one of two literals above, never user input.
    const rows = await this.prisma.$queryRaw<{ day: Date; n: bigint }[]>(
      Prisma.sql`
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC')::date AS day, count(*) AS n
        FROM ${Prisma.raw(`"${table}"`)}
        WHERE "createdAt" >= ${from} AND "deletedAt" IS NULL
        GROUP BY 1 ORDER BY 1`,
    );
    return rows.map((r) => ({
      day: r.day.toISOString().slice(0, 10),
      count: Number(r.n),
    }));
  }

  /** Zero-fills days with no signups so a chart has one point per day. */
  private fillDays(rows: DayCount[], from: Date): DayCount[] {
    const byDay = new Map(rows.map((r) => [r.day, r.count]));
    return Array.from({ length: SERIES_DAYS }, (_, i) => {
      const day = new Date(from.getTime() + i * DAY_MS)
        .toISOString()
        .slice(0, 10);
      return { day, count: byDay.get(day) ?? 0 };
    });
  }
}

export type AdminPage<T> = CursorPage<T>;
