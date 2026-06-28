import { BadRequestException, Injectable } from '@nestjs/common';
import { ProductionStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { JoinScoreboardDto } from '../../presentation/dto/join-scoreboard.dto';
import { LeaderboardQueryDto } from '../../presentation/dto/leaderboard-query.dto';

const EXCLUDED_STATUS: ProductionStatus[] = [
  ProductionStatus.SOLD,
  ProductionStatus.DECEASED,
];
const TOP_TIER_AQR = 90;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Scoreboard / national leaderboard (PRD §18 / API §14, RAKHAL-206, V1.5).
 *
 * Opt-in is per farm (`ScoreboardParticipation`); the leaderboard is a deliberate
 * **cross-tenant** read restricted to farms that have opted in — a farm's herd is
 * only ever visible after the Owner accepts the data-visibility terms. Own cattle
 * are flagged `is_own`. `market_value` and AQR trend are not modelled yet → null.
 */
@Injectable()
export class ScoreboardService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ScoreboardService.name);
  }

  async join(farmId: string, userId: string, dto: JoinScoreboardDto) {
    if (!dto.accept_data_visibility_terms) {
      throw new BadRequestException(
        'You must accept the data-visibility terms to join the leaderboard',
      );
    }
    const now = new Date();
    const row = await this.prisma.scoreboardParticipation.upsert({
      where: { farmId },
      create: { farmId, joinedBy: userId, acceptedTermsAt: now },
      update: { joinedBy: userId, acceptedTermsAt: now },
    });
    this.log.info('Farm joined scoreboard', { farmId });
    return { leaderboard_joined: true, visible_from: row.joinedAt };
  }

  async leave(farmId: string) {
    await this.prisma.scoreboardParticipation.deleteMany({ where: { farmId } });
    this.log.info('Farm left scoreboard', { farmId });
    return { leaderboard_joined: false };
  }

  async highlights(farmId: string) {
    const farm = await this.prisma.farm.findUniqueOrThrow({
      where: { id: farmId },
      select: {
        district: true,
        scoreboardParticipation: { select: { id: true } },
      },
    });

    const herdWhere = {
      farmId,
      isActive: true,
      productionStatus: { notIn: EXCLUDED_STATUS },
      aqrScore: { not: null },
    };

    const [topTier, bestCow, avgAgg] = await Promise.all([
      this.prisma.cattle.count({
        where: { ...herdWhere, aqrScore: { gte: TOP_TIER_AQR } },
      }),
      this.prisma.cattle.findFirst({
        where: herdWhere,
        orderBy: { aqrScore: 'desc' },
        select: { id: true, name: true, tagNumber: true, aqrScore: true },
      }),
      this.prisma.cattle.aggregate({
        where: herdWhere,
        _avg: { aqrScore: true },
      }),
    ]);

    return {
      top_tier_cows_count: topTier,
      best_performing_cow: bestCow
        ? {
            id: bestCow.id,
            name: bestCow.name ?? bestCow.tagNumber,
            aqr_score: round1(bestCow.aqrScore ?? 0),
          }
        : null,
      best_performing_farm_in_district: await this.bestFarmInDistrict(
        farmId,
        farm.district,
      ),
      avg_herd_aqr: avgAgg._avg.aqrScore ? round1(avgAgg._avg.aqrScore) : null,
      // No AQR history snapshots yet (RD-012) — trend deferred.
      aqr_change_pct: null,
      change_period: 'vs_last_month',
      leaderboard_joined: Boolean(farm.scoreboardParticipation),
    };
  }

  async leaderboard(farmId: string, query: LeaderboardQueryDto) {
    const scopedFarmIds = await this.scopedFarmIds(farmId, query.scope);
    return query.view === 'top_firms'
      ? this.topFirms(farmId, scopedFarmIds, query)
      : this.starCows(farmId, scopedFarmIds, query);
  }

  // ---- views --------------------------------------------------------------

  private async starCows(
    farmId: string,
    scopedFarmIds: string[],
    query: LeaderboardQueryDto,
  ) {
    const where = {
      farmId: { in: scopedFarmIds },
      isActive: true,
      productionStatus: { notIn: EXCLUDED_STATUS },
      aqrScore: { not: null },
    };
    const offset = (query.page - 1) * query.per_page;

    const [total, rows] = await Promise.all([
      this.prisma.cattle.count({ where }),
      this.prisma.cattle.findMany({
        where,
        orderBy: [{ aqrScore: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: query.per_page,
        select: {
          id: true,
          name: true,
          tagNumber: true,
          aqrScore: true,
          farmId: true,
          breed: { select: { name: true } },
          farm: { select: { name: true, district: true } },
        },
      }),
    ]);

    const milkByCow = await this.recentDailyMilk(rows.map((r) => r.id));

    const entries = rows.map((r, i) => ({
      rank: offset + i + 1,
      rank_trend: 'stable',
      cattle_id: r.id,
      name: r.name ?? r.tagNumber,
      tag: r.tagNumber,
      breed: r.breed?.name ?? null,
      farm_name: r.farm.name,
      district: r.farm.district,
      aqr_score: round1(r.aqrScore ?? 0),
      milk_production_l_day: milkByCow.get(r.id) ?? 0,
      market_value: null,
      is_own: r.farmId === farmId,
    }));

    return {
      scope: query.scope,
      view: 'star_cows' as const,
      own_farm_id: farmId,
      entries,
      meta: { page: query.page, per_page: query.per_page, total },
    };
  }

  private async topFirms(
    farmId: string,
    scopedFarmIds: string[],
    query: LeaderboardQueryDto,
  ) {
    const grouped = await this.prisma.cattle.groupBy({
      by: ['farmId'],
      where: {
        farmId: { in: scopedFarmIds },
        isActive: true,
        productionStatus: { notIn: EXCLUDED_STATUS },
        aqrScore: { not: null },
      },
      _avg: { aqrScore: true },
      _count: { _all: true },
    });

    const ranked = grouped
      .map((g) => ({
        farmId: g.farmId,
        avg_aqr: round1(g._avg.aqrScore ?? 0),
        cattle_count: g._count._all,
      }))
      .sort((a, b) => b.avg_aqr - a.avg_aqr);

    const farms = await this.prisma.farm.findMany({
      where: { id: { in: ranked.map((r) => r.farmId) } },
      select: { id: true, name: true, district: true },
    });
    const farmById = new Map(farms.map((f) => [f.id, f]));

    const offset = (query.page - 1) * query.per_page;
    const entries = ranked
      .slice(offset, offset + query.per_page)
      .map((r, i) => ({
        rank: offset + i + 1,
        rank_trend: 'stable',
        farm_id: r.farmId,
        farm_name: farmById.get(r.farmId)?.name ?? null,
        district: farmById.get(r.farmId)?.district ?? null,
        avg_aqr: r.avg_aqr,
        cattle_count: r.cattle_count,
        is_own: r.farmId === farmId,
      }));

    return {
      scope: query.scope,
      view: 'top_firms' as const,
      own_farm_id: farmId,
      entries,
      meta: {
        page: query.page,
        per_page: query.per_page,
        total: ranked.length,
      },
    };
  }

  // ---- helpers ------------------------------------------------------------

  /** Opted-in farm ids, narrowed to the requested geographic scope. */
  private async scopedFarmIds(
    farmId: string,
    scope: LeaderboardQueryDto['scope'],
  ): Promise<string[]> {
    const participations = await this.prisma.scoreboardParticipation.findMany({
      select: {
        farmId: true,
        farm: { select: { district: true, division: true } },
      },
    });
    if (scope === 'national') return participations.map((p) => p.farmId);

    const me = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: { district: true, division: true },
    });
    return participations
      .filter((p) =>
        scope === 'district'
          ? me?.district && p.farm.district === me.district
          : me?.division && p.farm.division === me.division,
      )
      .map((p) => p.farmId);
  }

  /** Best opted-in farm in the given district by average herd AQR (privacy: opt-in only). */
  private async bestFarmInDistrict(farmId: string, district: string | null) {
    if (!district) return null;
    const participants = await this.prisma.scoreboardParticipation.findMany({
      where: { farm: { district } },
      select: { farmId: true, farm: { select: { name: true } } },
    });
    if (participants.length === 0) return null;

    const grouped = await this.prisma.cattle.groupBy({
      by: ['farmId'],
      where: {
        farmId: { in: participants.map((p) => p.farmId) },
        isActive: true,
        productionStatus: { notIn: EXCLUDED_STATUS },
        aqrScore: { not: null },
      },
      _avg: { aqrScore: true },
    });
    if (grouped.length === 0) return null;

    const best = grouped.reduce((a, b) =>
      (b._avg.aqrScore ?? 0) > (a._avg.aqrScore ?? 0) ? b : a,
    );
    const name =
      participants.find((p) => p.farmId === best.farmId)?.farm.name ?? null;
    return { name, avg_aqr: round1(best._avg.aqrScore ?? 0) };
  }

  /** Average daily litres over the last 7 days, per cattle id. */
  private async recentDailyMilk(
    cattleIds: string[],
  ): Promise<Map<string, number>> {
    if (cattleIds.length === 0) return new Map();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.milkLogEntry.groupBy({
      by: ['cattleId'],
      where: { cattleId: { in: cattleIds }, logDate: { gte: since } },
      _sum: { yieldL: true },
    });
    return new Map(
      grouped.map((g) => [g.cattleId, round1((g._sum.yieldL ?? 0) / 7)]),
    );
  }
}
