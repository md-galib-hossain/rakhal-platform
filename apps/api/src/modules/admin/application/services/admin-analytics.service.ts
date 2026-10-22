import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { toCsv } from '../../domain/csv';
import { AdminAuditService } from './admin-audit.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Hard cap per export: bounds memory and the blast radius of a leaked file. */
export const EXPORT_ROW_LIMIT = 10_000;

export type ExportKind = 'farms' | 'users' | 'subscriptions';

/**
 * Usage analytics and CSV exports (Phase 6). Analytics definitions are stated next to each number so they are
 * auditable; exports are row-capped, formula-injection-safe (`toCsv`) and every one is audited with its row
 * count, because they leave the system.
 */
@Injectable()
export class AdminAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  /**
   * - `subscriptions`: each farm counted once, by its **latest** `FarmSubscription`.
   * - `mrr`: sum of the **list monthly price** of farms whose latest subscription is ACTIVE (comped farms
   *   included — it is a list-price estimate, not recognised revenue).
   * - `revenue`: sum of `total` of invoices with status PAID created in the window.
   * - `activeFarms`: farms where any member's session was used within the window.
   * - `expiring`: ACTIVE/TRIALING subscriptions ending in the next 14 days (up to 25, soonest first).
   */
  async usage() {
    const now = new Date();
    const since = (days: number) => new Date(now.getTime() - days * DAY_MS);

    const [byPlan, mrr, revenue, active7, active30, expiring] =
      await Promise.all([
        this.prisma.$queryRaw<{ plan: string; status: string; n: bigint }[]>`
        SELECT p.name AS plan, s.status::text AS status, count(*) AS n
        FROM (
          SELECT DISTINCT ON ("farmId") "subscriptionPlanId", status
          FROM "FarmSubscription"
          ORDER BY "farmId", "createdAt" DESC
        ) s
        JOIN "SubscriptionPlan" p ON p.id = s."subscriptionPlanId"
        GROUP BY 1, 2
        ORDER BY 1, 2`,
        this.prisma.$queryRaw<{ total: string | null }[]>`
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
        this.prisma.$queryRaw<
          {
            farmId: string;
            farm: string;
            plan: string;
            status: string;
            expiresAt: Date;
          }[]
        >`
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

    const plans = new Map<string, Record<string, number>>();
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

  private async activeFarms(since: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(DISTINCT fm."farmId") AS n
      FROM "FarmMember" fm
      JOIN "Session" s ON s."userId" = fm."userId"
      JOIN "Farm" f ON f.id = fm."farmId" AND f."deletedAt" IS NULL
      WHERE s."lastUsedAt" >= ${since}`;
    return Number(rows[0]?.n ?? 0);
  }

  // -------------------------------------------------------------- exports

  async export(
    actorId: string,
    kind: ExportKind,
  ): Promise<{ filename: string; csv: string; rows: number }> {
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
        truncated: rows.length >= EXPORT_ROW_LIMIT,
      },
    });
    return {
      filename: `rakhal-${kind}-${stamp}.csv`,
      csv: toCsv(headers, rows),
      rows: rows.length,
    };
  }

  private async collect(
    kind: ExportKind,
  ): Promise<{ headers: string[]; rows: unknown[][] }> {
    if (kind === 'users') {
      const users = await this.prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: EXPORT_ROW_LIMIT,
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
      take: EXPORT_ROW_LIMIT,
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
}
