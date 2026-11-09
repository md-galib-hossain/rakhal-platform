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
var CattleDetailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CattleDetailService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const lactation_curve_1 = require("../../domain/lactation-curve");
const cattle_finance_aggregation_1 = require("./cattle-finance-aggregation");
const aqr_trend_1 = require("./aqr-trend");
let CattleDetailService = CattleDetailService_1 = class CattleDetailService {
    prisma;
    logger;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.logger = logger;
        this.log = this.logger.setContext(CattleDetailService_1.name);
    }
    async overview(farmId, cattleId) {
        const cattle = await this.getCattleOrThrow(farmId, cattleId);
        const now = new Date();
        const aqrThenMap = await (0, aqr_trend_1.computeAqrScoreAsOf)(this.prisma, farmId, [{ id: cattle.id, aqrScore: cattle.aqrScore }], this.daysAgo(now, 30));
        const aqrThen = aqrThenMap.get(cattle.id) ?? null;
        const [weightRecords, bcsRecords, activeLactation, last14Days, lifetime] = await Promise.all([
            this.prisma.weightRecord.findMany({
                where: { cattleId },
                orderBy: { recordedDate: 'desc' },
                take: 24,
            }),
            this.prisma.bodyConditionScore.findMany({
                where: { cattleId },
                orderBy: { recordedDate: 'desc' },
                take: 24,
            }),
            this.prisma.lactation.findFirst({
                where: { cattleId, status: client_1.LactationStatus.ACTIVE },
                orderBy: { startDate: 'desc' },
                select: { startDate: true },
            }),
            this.prisma.milkLogEntry.findMany({
                where: {
                    cattleId,
                    logDate: { gte: this.daysAgo(now, 14) },
                },
                select: { logDate: true, session: true, yieldL: true },
            }),
            this.prisma.milkLogEntry.findMany({
                where: { cattleId },
                select: { logDate: true, yieldL: true },
            }),
        ]);
        const dailyTotals = this.dailyTotals(last14Days);
        const last7 = this.sumOnOrAfter(dailyTotals, this.daysAgo(now, 7));
        const prev7 = this.sumBetween(dailyTotals, this.daysAgo(now, 14), this.daysAgo(now, 7));
        const [latestWeight, priorWeight] = weightRecords;
        return {
            aqr_score: cattle.aqrScore,
            aqr_change_pct: cattle.aqrScore !== null && aqrThen !== null
                ? (0, lactation_curve_1.trendPct)(cattle.aqrScore, aqrThen)
                : null,
            avg_daily_yield_7d: this.round(last7 / 7),
            yield_change_pct: (0, lactation_curve_1.trendPct)(last7, prev7),
            last_weight_kg: latestWeight?.weightKg ?? cattle.lastWeightKg ?? null,
            weight_change_pct: latestWeight && priorWeight
                ? (0, lactation_curve_1.trendPct)(latestWeight.weightKg, priorWeight.weightKg)
                : null,
            bcs_records: bcsRecords.map((r) => ({
                date: r.recordedDate,
                score: r.score,
            })),
            weight_history: weightRecords.map((r) => ({
                date: r.recordedDate,
                weight_kg: r.weightKg,
            })),
            lactation_curve: activeLactation
                ? (0, lactation_curve_1.buildLactationCurve)(activeLactation.startDate, await this.curveYields(cattleId, activeLactation.startDate))
                : [],
            lifetime_yield: this.lifetimeByYear(lifetime),
            recent_milk_records: this.recentMilkRecords(last14Days),
        };
    }
    async pedigree(farmId, cattleId) {
        const self = await this.prisma.cattle.findFirst({
            where: { id: cattleId, farmId },
            include: {
                farm: { select: { name: true } },
            },
        });
        if (!self) {
            this.log.warn('Cattle not found', { cattleId, farmId });
            throw new common_1.NotFoundException('Cattle not found');
        }
        const dam = self.motherId
            ? await this.getAncestors(self.motherId, 5, new Set([cattleId]))
            : null;
        const sire = self.fatherId
            ? await this.getAncestors(self.fatherId, 5, new Set([cattleId]))
            : {
                id: null,
                name: null,
                tag: null,
                gender: 'male',
                farm_name: null,
                is_external: true,
                dam: null,
                sire: null,
            };
        const siblings = self.motherId || self.fatherId
            ? await this.prisma.cattle.findMany({
                where: {
                    farmId,
                    id: { not: cattleId },
                    OR: [
                        ...(self.motherId ? [{ motherId: self.motherId }] : []),
                        ...(self.fatherId ? [{ fatherId: self.fatherId }] : []),
                    ],
                },
                orderBy: { tagNumber: 'asc' },
                select: {
                    id: true,
                    name: true,
                    tagNumber: true,
                    gender: true,
                    motherId: true,
                    fatherId: true,
                    farm: { select: { name: true } },
                },
            })
            : [];
        const offspring = await this.prisma.cattle.findMany({
            where: { farmId, OR: [{ motherId: cattleId }, { fatherId: cattleId }] },
            orderBy: { tagNumber: 'asc' },
            select: {
                id: true,
                name: true,
                tagNumber: true,
                gender: true,
                dateOfBirth: true,
                farm: { select: { name: true } },
            },
        });
        return {
            self: {
                ...this.pedigreeNode(self),
                dam: dam ?? null,
                sire: sire ?? null,
            },
            dam,
            sire: sire
                ? { ...sire, is_external: !self.fatherId }
                : {
                    id: null,
                    name: null,
                    tag: null,
                    gender: 'male',
                    farm_name: null,
                    is_external: true,
                    dam: null,
                    sire: null,
                },
            siblings: siblings.map((s) => ({
                ...this.pedigreeNode(s),
                relation: self.motherId &&
                    self.fatherId &&
                    s.motherId === self.motherId &&
                    s.fatherId === self.fatherId
                    ? 'full_sibling'
                    : 'half_sibling',
            })),
            offspring: offspring.map((o) => ({
                id: o.id,
                name: o.name,
                tag: o.tagNumber,
                gender: o.gender,
                birth_date: o.dateOfBirth,
                farm_name: o.farm?.name ?? null,
            })),
        };
    }
    async cattleFinance(farmId, cattleId, period) {
        await this.getCattleOrThrow(farmId, cattleId);
        const { start, end, label } = this.monthRange(period);
        const chartStart = this.monthsAgo(start, 5);
        const [totals, animalSaleLines, breedingExpenses, healthExpenses, feedCostItems, milkEntries, effectiveMilkRate,] = await Promise.all([
            (0, cattle_finance_aggregation_1.computeCattleFinance)(this.prisma, farmId, cattleId, start, end),
            this.prisma.animalSaleLine.findMany({
                where: {
                    cattleId,
                    saleLine: {
                        sale: {
                            farmId,
                            status: client_1.SaleStatus.CONFIRMED,
                            saleDate: { gte: chartStart, lt: end },
                        },
                    },
                },
                select: {
                    saleLine: {
                        select: { totalAmount: true, sale: { select: { saleDate: true } } },
                    },
                },
            }),
            this.prisma.expense.findMany({
                where: {
                    farmId,
                    cattleId,
                    category: client_1.ExpenseCategory.BREEDING,
                    voidedAt: null,
                    expenseDate: { gte: chartStart, lt: end },
                },
                select: { amount: true, expenseDate: true },
            }),
            this.prisma.expense.findMany({
                where: {
                    farmId,
                    cattleId,
                    category: client_1.ExpenseCategory.HEALTH,
                    voidedAt: null,
                    expenseDate: { gte: chartStart, lt: end },
                },
                select: { amount: true, expenseDate: true },
            }),
            this.prisma.feedDistributionCattleItem.findMany({
                where: {
                    cattleId,
                    voidedAt: null,
                    costTk: { not: null },
                    distribution: { farmId, distributedAt: { gte: chartStart, lt: end } },
                },
                select: {
                    costTk: true,
                    distribution: { select: { distributedAt: true } },
                },
            }),
            this.prisma.milkLogEntry.findMany({
                where: {
                    cattleId,
                    disposition: client_1.MilkDisposition.SALEABLE,
                    logDate: { gte: chartStart, lt: end },
                },
                select: { yieldL: true, logDate: true },
            }),
            (0, cattle_finance_aggregation_1.resolveEffectiveMilkRate)(this.prisma, farmId, end),
        ]);
        return {
            period: label,
            total_income: this.round(totals.totalIncome),
            total_cost: this.round(totals.totalCost),
            net_profit: this.round(totals.totalIncome - totals.totalCost),
            expense_breakdown: this.roundAll(totals.expense),
            income_breakdown: this.roundAll(totals.income),
            monthly_chart: this.monthlyChart({
                animalSaleLines,
                breedingExpenses,
                healthExpenses,
                feedCostItems,
                milkEntries,
                effectiveMilkRate,
                start,
            }),
        };
    }
    async curveYields(cattleId, since) {
        const rows = await this.prisma.milkLogEntry.findMany({
            where: { cattleId, logDate: { gte: since } },
            select: { logDate: true, yieldL: true },
        });
        return this.dailyTotals(rows);
    }
    dailyTotals(rows) {
        const byDay = new Map();
        for (const row of rows) {
            const key = row.logDate.getTime();
            byDay.set(key, (byDay.get(key) ?? 0) + row.yieldL);
        }
        return [...byDay.entries()]
            .map(([time, totalL]) => ({ date: new Date(time), totalL }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    recentMilkRecords(rows) {
        const byDay = new Map();
        for (const row of rows) {
            const key = row.logDate.getTime();
            const day = byDay.get(key) ?? {
                morning_l: 0,
                noon_l: 0,
                evening_l: 0,
                night_l: 0,
            };
            day[this.sessionField(row.session)] += row.yieldL;
            byDay.set(key, day);
        }
        return [...byDay.entries()]
            .sort((a, b) => b[0] - a[0])
            .slice(0, 7)
            .map(([time, s]) => ({
            date: new Date(time),
            morning_l: this.round(s.morning_l),
            noon_l: this.round(s.noon_l),
            evening_l: this.round(s.evening_l),
            night_l: this.round(s.night_l),
            total_l: this.round(s.morning_l + s.noon_l + s.evening_l + s.night_l),
        }));
    }
    sessionField(session) {
        switch (session) {
            case client_1.MilkSession.MORNING:
                return 'morning_l';
            case client_1.MilkSession.NOON:
                return 'noon_l';
            case client_1.MilkSession.EVENING:
                return 'evening_l';
            case client_1.MilkSession.NIGHT:
                return 'night_l';
        }
    }
    lifetimeByYear(rows) {
        const byYear = new Map();
        for (const row of rows) {
            const year = row.logDate.getUTCFullYear();
            byYear.set(year, (byYear.get(year) ?? 0) + row.yieldL);
        }
        return [...byYear.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([year, total]) => ({ year, total_l: this.round(total) }));
    }
    monthlyChart(params) {
        const { animalSaleLines, breedingExpenses, healthExpenses, feedCostItems, milkEntries, effectiveMilkRate, start, } = params;
        const months = [];
        for (let i = 5; i >= 0; i -= 1) {
            const m = this.monthsAgo(start, i);
            months.push({ month: this.monthLabel(m), income: 0, cost: 0 });
        }
        const index = new Map(months.map((m, i) => [m.month, i]));
        for (const line of animalSaleLines) {
            const i = index.get(this.monthLabel(line.saleLine.sale.saleDate));
            if (i === undefined)
                continue;
            months[i].income += Number(line.saleLine.totalAmount);
        }
        if (effectiveMilkRate > 0) {
            for (const entry of milkEntries) {
                const i = index.get(this.monthLabel(entry.logDate));
                if (i === undefined)
                    continue;
                months[i].income += entry.yieldL * effectiveMilkRate;
            }
        }
        for (const e of breedingExpenses) {
            const i = index.get(this.monthLabel(e.expenseDate));
            if (i === undefined)
                continue;
            months[i].cost += Number(e.amount);
        }
        for (const e of healthExpenses) {
            const i = index.get(this.monthLabel(e.expenseDate));
            if (i === undefined)
                continue;
            months[i].cost += Number(e.amount);
        }
        for (const f of feedCostItems) {
            if (f.costTk === null)
                continue;
            const i = index.get(this.monthLabel(f.distribution.distributedAt));
            if (i === undefined)
                continue;
            months[i].cost += f.costTk;
        }
        return months.map((m) => ({
            month: m.month,
            income: this.round(m.income),
            cost: this.round(m.cost),
        }));
    }
    sumOnOrAfter(daily, from) {
        return daily
            .filter((d) => d.date.getTime() >= from.getTime())
            .reduce((acc, d) => acc + d.totalL, 0);
    }
    sumBetween(daily, from, to) {
        return daily
            .filter((d) => d.date.getTime() >= from.getTime() && d.date.getTime() < to.getTime())
            .reduce((acc, d) => acc + d.totalL, 0);
    }
    monthRange(period) {
        const now = new Date();
        let year = now.getUTCFullYear();
        let month = now.getUTCMonth();
        if (period && /^\d{4}-\d{2}$/.test(period)) {
            const [y, m] = period.split('-').map(Number);
            year = y;
            month = m - 1;
        }
        const start = new Date(Date.UTC(year, month, 1));
        const end = new Date(Date.UTC(year, month + 1, 1));
        return { start, end, label: this.monthLabel(start) };
    }
    monthsAgo(from, n) {
        return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - n, 1));
    }
    monthLabel(date) {
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    daysAgo(from, n) {
        const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
        d.setUTCDate(d.getUTCDate() - n);
        return d;
    }
    pedigreeSelect() {
        return {
            id: true,
            name: true,
            tagNumber: true,
            gender: true,
            farm: { select: { name: true } },
        };
    }
    pedigreeNode(c) {
        return {
            id: c.id,
            name: c.name,
            tag: c.tagNumber,
            gender: c.gender,
            farm_name: c.farm?.name ?? null,
        };
    }
    async getAncestors(cattleId, depth = 5, visited = new Set()) {
        if (depth < 1 || visited.has(cattleId))
            return null;
        visited.add(cattleId);
        const cattle = await this.prisma.cattle.findUnique({
            where: { id: cattleId },
            select: {
                id: true,
                name: true,
                tagNumber: true,
                gender: true,
                motherId: true,
                fatherId: true,
                farm: { select: { name: true } },
            },
        });
        if (!cattle)
            return null;
        const dam = cattle.motherId
            ? await this.getAncestors(cattle.motherId, depth - 1, new Set(visited))
            : null;
        const sire = cattle.fatherId
            ? await this.getAncestors(cattle.fatherId, depth - 1, new Set(visited))
            : null;
        return {
            id: cattle.id,
            name: cattle.name,
            tag: cattle.tagNumber,
            gender: cattle.gender,
            farm_name: cattle.farm?.name ?? null,
            dam: dam ?? null,
            sire: sire ?? null,
        };
    }
    roundAll(obj) {
        const out = {};
        for (const key of Object.keys(obj)) {
            out[key] = this.round(obj[key]);
        }
        return out;
    }
    round(value) {
        return Math.round(value * 100) / 100;
    }
    async getCattleOrThrow(farmId, id, include) {
        const cattle = await this.prisma.cattle.findFirst({
            where: { id, farmId },
            include,
        });
        if (!cattle) {
            this.log.warn('Cattle not found', { cattleId: id, farmId });
            throw new common_1.NotFoundException('Cattle not found');
        }
        return cattle;
    }
};
exports.CattleDetailService = CattleDetailService;
exports.CattleDetailService = CattleDetailService = CattleDetailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], CattleDetailService);
//# sourceMappingURL=cattle-detail.service.js.map