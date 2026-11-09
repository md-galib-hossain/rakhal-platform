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
var DashboardService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const txn_filters_1 = require("src/common/finance/txn-filters");
const runway_1 = require("src/common/finance/runway");
const period_1 = require("src/common/finance/period");
const balance_service_1 = require("src/modules/finance-v2/accounts/application/balance.service");
const milk_service_1 = require("src/modules/milk/application/services/milk.service");
const health_service_1 = require("src/modules/health/application/services/health.service");
const farm_settings_service_1 = require("src/modules/farm-settings/farm-settings.service");
const feed_distribution_service_1 = require("src/modules/feed/application/services/feed-distribution.service");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const animal_category_1 = require("src/modules/cattle/domain/animal-category");
const lactation_stage_1 = require("src/modules/reproduction/domain/lactation-stage");
const cache_service_1 = require("src/core/cache/cache.service");
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_CASE_STATUSES = [
    client_1.HealthCaseStatus.ACTIVE,
    client_1.HealthCaseStatus.IMPROVING,
    client_1.HealthCaseStatus.WORSENING,
    client_1.HealthCaseStatus.STABLE,
];
const PRIORITY_CATTLE_LIMIT = 50;
let DashboardService = DashboardService_1 = class DashboardService {
    prisma;
    balance;
    milk;
    health;
    farmSettings;
    feedDistribution;
    cache;
    log;
    constructor(prisma, balance, milk, health, farmSettings, feedDistribution, cache, logger) {
        this.prisma = prisma;
        this.balance = balance;
        this.milk = milk;
        this.health = health;
        this.farmSettings = farmSettings;
        this.feedDistribution = feedDistribution;
        this.cache = cache;
        this.log = logger.setContext(DashboardService_1.name);
    }
    async overviewBatch(farmId) {
        return this.cache.getOrSet(`dashboard:batch:${farmId}`, 60, async () => {
            const now = new Date();
            const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            const previous = (0, period_1.derivePreviousPeriod)({ from: monthStart, to: now });
            const [milkOverview, herdStatus, sharedFinance, priorities, calvingForecast, feedStockAlerts, upcomingTasks, feedCostSummary, [health, healthThreshold], [income, expense, prevIncome, prevExpense],] = await Promise.all([
                this.milk.overview(farmId),
                this.herdStatus(farmId),
                this.financeSnapshot(farmId),
                this.priorities(farmId),
                this.calvingForecast(farmId),
                this.feedStockAlerts(farmId),
                this.upcomingTasks(farmId),
                this.feedCostSummary(farmId),
                Promise.all([
                    this.health.getHealthDashboard(farmId),
                    this.farmSettings.healthScoreWarningPct(farmId),
                ]),
                Promise.all([
                    this.txnSum(farmId, true, monthStart, now),
                    this.txnSum(farmId, false, monthStart, now),
                    this.txnSum(farmId, true, previous.from, previous.to),
                    this.txnSum(farmId, false, previous.from, previous.to),
                ]),
            ]);
            const yieldChangePct = this.changePct(milkOverview.today.totalL, milkOverview.yesterday.totalL);
            const kpis = {
                costPerLitre: {
                    value: sharedFinance.costPerLitreThisMonth,
                    currency: 'Tk',
                },
                todaysYield: {
                    value: milkOverview.today.totalL,
                    unit: 'L',
                    changePct: yieldChangePct,
                    changeDirection: yieldChangePct == null ? null : yieldChangePct >= 0 ? 'up' : 'down',
                    changePeriod: 'vs_yesterday',
                },
                herdHealth: {
                    value: health.herdHealthScore,
                    unit: '%',
                    sickCount: health.sickBayCount,
                    threshold: healthThreshold,
                },
                cashRunway: {
                    value: sharedFinance.survivalRunwayDays,
                    unit: 'days',
                    status: sharedFinance.survivalRunwayStatus,
                },
            };
            const livestockState = {
                period: 'today',
                states: [
                    {
                        state: 'fresh',
                        count: herdStatus.productionBreakdown.fresh,
                        color: '#1A7A4A',
                    },
                    {
                        state: 'milking',
                        count: herdStatus.productionBreakdown.milking,
                        color: '#14B8A6',
                    },
                    {
                        state: 'dry',
                        count: herdStatus.productionBreakdown.dry,
                        color: '#7C3AED',
                    },
                    {
                        state: 'pregnant',
                        count: herdStatus.reproductiveBreakdown.pregnant,
                        color: '#D97706',
                    },
                    {
                        state: 'insemination',
                        count: herdStatus.reproductiveBreakdown.inseminated,
                        color: '#2563EB',
                    },
                    {
                        state: 'sick',
                        count: herdStatus.healthBreakdown.sick,
                        color: '#DC2626',
                    },
                ],
            };
            const productionSummary = {
                period: 'today',
                totalYieldL: milkOverview.today.totalL,
                sellableL: milkOverview.today.sellableL,
                withholdingL: milkOverview.today.withholdingL,
                calfAllocationL: milkOverview.today.calfL,
                comparison: {
                    yesterday: milkOverview.yesterday.totalL,
                    sameDayLastWeek: milkOverview.sameDayLastWeek.totalL,
                    sameDayLastYear: milkOverview.sameDayLastYear.totalL,
                },
                sessions: milkOverview.sessionsStatus,
            };
            const financialSnapshot = {
                period: monthStart.toISOString().slice(0, 7),
                income: {
                    current: income,
                    previous: prevIncome,
                    changePct: this.changePct(income, prevIncome),
                },
                expenses: {
                    current: expense,
                    previous: prevExpense,
                    changePct: this.changePct(expense, prevExpense),
                },
                profit: {
                    current: this.round(income - expense),
                    previous: this.round(prevIncome - prevExpense),
                    changePct: this.changePct(income - expense, prevIncome - prevExpense),
                },
                survivalRunway: {
                    days: sharedFinance.survivalRunwayDays,
                    availableLiquidity: sharedFinance.availableLiquidity,
                    status: sharedFinance.survivalRunwayStatus,
                },
            };
            return {
                priorities,
                kpis,
                herdStatus,
                livestockState,
                productionSummary,
                calvingForecast,
                feedStockAlerts,
                upcomingTasks,
                financialSnapshot,
                feedCostSummary,
            };
        });
    }
    async feedCostSummary(farmId) {
        return this.feedDistribution.getFarmFeedCostSummary(farmId, 7);
    }
    async kpis(farmId) {
        const [finance, milk, health, healthThreshold] = await Promise.all([
            this.financeSnapshot(farmId),
            this.milk.overview(farmId),
            this.health.getHealthDashboard(farmId),
            this.farmSettings.healthScoreWarningPct(farmId),
        ]);
        const yieldChangePct = this.changePct(milk.today.totalL, milk.yesterday.totalL);
        return {
            costPerLitre: {
                value: finance.costPerLitreThisMonth,
                currency: 'Tk',
            },
            todaysYield: {
                value: milk.today.totalL,
                unit: 'L',
                changePct: yieldChangePct,
                changeDirection: yieldChangePct == null ? null : yieldChangePct >= 0 ? 'up' : 'down',
                changePeriod: 'vs_yesterday',
            },
            herdHealth: {
                value: health.herdHealthScore,
                unit: '%',
                sickCount: health.sickBayCount,
                threshold: healthThreshold,
            },
            cashRunway: {
                value: finance.survivalRunwayDays,
                unit: 'days',
                status: finance.survivalRunwayStatus,
            },
        };
    }
    async productionSummary(farmId, period) {
        const overview = await this.milk.overview(farmId);
        if (period === 'today') {
            return {
                period,
                totalYieldL: overview.today.totalL,
                sellableL: overview.today.sellableL,
                withholdingL: overview.today.withholdingL,
                calfAllocationL: overview.today.calfL,
                comparison: {
                    yesterday: overview.yesterday.totalL,
                    sameDayLastWeek: overview.sameDayLastWeek.totalL,
                    sameDayLastYear: overview.sameDayLastYear.totalL,
                },
                sessions: overview.sessionsStatus,
            };
        }
        const { gte } = this.periodRange(period);
        const rows = await this.prisma.milkLogEntry.groupBy({
            by: ['tankType'],
            where: { farmId, submitted: true, logDate: { gte } },
            _sum: { yieldL: true },
        });
        const byType = new Map(rows.map((r) => [r.tankType, r._sum.yieldL ?? 0]));
        const sellableL = this.round(byType.get(client_1.MilkTankType.SELLABLE) ?? 0);
        const withholdingL = this.round(byType.get(client_1.MilkTankType.WITHHOLDING) ?? 0);
        return {
            period,
            totalYieldL: this.round(sellableL + withholdingL),
            sellableL,
            withholdingL,
            calfAllocationL: 0,
            comparison: null,
            sessions: null,
        };
    }
    async calvingForecast(farmId) {
        const now = new Date();
        const horizon = new Date(now.getTime() + 7 * DAY_MS);
        const pregnancies = await this.prisma.pregnancy.findMany({
            where: {
                status: client_1.PregnancyStatus.ACTIVE,
                expectedCalvingDate: { gte: now, lte: horizon },
                cattle: (0, herd_scope_1.activeHerd)(farmId),
            },
            orderBy: { expectedCalvingDate: 'asc' },
            include: {
                cattle: {
                    select: {
                        id: true,
                        name: true,
                        tagNumber: true,
                        shed: { select: { name: true } },
                    },
                },
            },
        });
        return {
            forecast: pregnancies.map((p) => ({
                cattleId: p.cattleId,
                name: p.cattle.name,
                tag: p.cattle.tagNumber,
                shed: p.cattle.shed?.name ?? null,
                expectedCalvingDate: p.expectedCalvingDate,
                daysRemaining: p.expectedCalvingDate
                    ? Math.max(0, Math.ceil((p.expectedCalvingDate.getTime() - now.getTime()) / DAY_MS))
                    : null,
                conceptionDate: p.conceptionDate,
            })),
        };
    }
    async herdStatus(farmId) {
        const now = new Date();
        const [totalActive, repro, milkingCount, dryCount, healthCaseByStatus, withholding, calves, femaleCattle, settings, categoryCounts,] = await Promise.all([
            this.prisma.cattle.count({
                where: (0, herd_scope_1.activeHerd)(farmId),
            }),
            this.prisma.reproductionProfile.groupBy({
                by: ['reproductiveStatus'],
                where: { cattle: (0, herd_scope_1.activeHerd)(farmId) },
                _count: { _all: true },
            }),
            this.prisma.cattle.count({
                where: {
                    ...(0, herd_scope_1.activeHerd)(farmId),
                    productionStatus: client_1.ProductionStatus.MILKING,
                },
            }),
            this.prisma.cattle.count({
                where: {
                    ...(0, herd_scope_1.activeHerd)(farmId),
                    productionStatus: client_1.ProductionStatus.DRY,
                },
            }),
            this.prisma.healthCase.groupBy({
                by: ['status'],
                where: {
                    farmId,
                    deletedAt: null,
                    status: { in: ACTIVE_CASE_STATUSES },
                },
                _count: { _all: true },
            }),
            this.prisma.safetyWithdrawal.count({
                where: { farmId, status: client_1.SafetyWithdrawalStatus.ACTIVE },
            }),
            this.prisma.cattle.findMany({
                where: {
                    ...(0, herd_scope_1.activeHerd)(farmId),
                    calfWeaningRecord: null,
                    ...(0, animal_category_1.buildAnimalCategoryWhere)('CALF', now),
                },
                select: { dateOfBirth: true },
            }),
            this.prisma.cattle.findMany({
                where: {
                    ...(0, herd_scope_1.activeHerd)(farmId),
                    gender: client_1.CattleGender.FEMALE,
                },
                select: {
                    dateOfBirth: true,
                    reproductionProfile: { select: { totalCalvings: true } },
                    lactations: {
                        where: { status: client_1.LactationStatus.ACTIVE, endDate: null },
                        select: { startDate: true },
                        orderBy: { startDate: 'desc' },
                        take: 1,
                    },
                    dryPeriods: {
                        where: { actualEndDate: null },
                        select: { id: true },
                        take: 1,
                    },
                },
            }),
            this.farmSettings.getEffective(farmId),
            Promise.all(animal_category_1.ANIMAL_CATEGORIES.map((category) => this.prisma.cattle.count({
                where: {
                    ...(0, herd_scope_1.activeHerd)(farmId),
                    ...(0, animal_category_1.buildAnimalCategoryWhere)(category, now),
                },
            }))),
        ]);
        const reproCount = (s) => repro.find((r) => r.reproductiveStatus === s)?._count._all ?? 0;
        const sick = healthCaseByStatus.find((r) => r.status === client_1.HealthCaseStatus.ACTIVE)
            ?._count._all ?? 0;
        const inTreatment = healthCaseByStatus
            .filter((r) => r.status !== client_1.HealthCaseStatus.ACTIVE)
            .reduce((sum, r) => sum + r._count._all, 0);
        const activeCases = sick + inTreatment;
        const healthy = Math.max(totalActive - activeCases, 0);
        const categoryBreakdown = Object.fromEntries(animal_category_1.ANIMAL_CATEGORIES.map((category, i) => [
            category.toLowerCase(),
            categoryCounts[i],
        ]));
        let fresh = 0;
        for (const cow of femaleCattle) {
            const lactationStage = (0, lactation_stage_1.deriveLactationStage)({
                now,
                lactationStartDate: cow.lactations[0]?.startDate ?? null,
                isInActiveDryPeriod: cow.dryPeriods.length > 0,
                farmSettings: {
                    freshDays: settings.lactationFreshDays,
                    earlyDays: settings.lactationEarlyDays,
                    midDays: settings.lactationMidDays,
                },
            });
            if (lactationStage === 'FRESH') {
                fresh += 1;
            }
        }
        return {
            totalActive,
            productionBreakdown: {
                milking: milkingCount,
                dry: dryCount,
                fresh,
            },
            categoryBreakdown,
            reproductiveBreakdown: {
                open: reproCount(client_1.ReproductionState.OPEN),
                inseminated: reproCount(client_1.ReproductionState.BRED_AWAITING_CONFIRMATION),
                pregnant: reproCount(client_1.ReproductionState.PREGNANT),
                dryPeriod: dryCount,
            },
            healthBreakdown: {
                healthy,
                sick,
                inTreatment,
                withholding,
            },
            calves: this.calfStageCounts(calves.map((c) => c.dateOfBirth), now),
        };
    }
    async livestockState(farmId, period) {
        const herd = await this.herdStatus(farmId);
        return {
            period,
            states: [
                {
                    state: 'fresh',
                    count: herd.productionBreakdown.fresh,
                    color: '#1A7A4A',
                },
                {
                    state: 'milking',
                    count: herd.productionBreakdown.milking,
                    color: '#14B8A6',
                },
                { state: 'dry', count: herd.productionBreakdown.dry, color: '#7C3AED' },
                {
                    state: 'pregnant',
                    count: herd.reproductiveBreakdown.pregnant,
                    color: '#D97706',
                },
                {
                    state: 'insemination',
                    count: herd.reproductiveBreakdown.inseminated,
                    color: '#2563EB',
                },
                { state: 'sick', count: herd.healthBreakdown.sick, color: '#DC2626' },
            ],
        };
    }
    async financialSnapshot(farmId) {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const previous = (0, period_1.derivePreviousPeriod)({ from: monthStart, to: now });
        const [income, expense, prevIncome, prevExpense, finance] = await Promise.all([
            this.txnSum(farmId, true, monthStart, now),
            this.txnSum(farmId, false, monthStart, now),
            this.txnSum(farmId, true, previous.from, previous.to),
            this.txnSum(farmId, false, previous.from, previous.to),
            this.financeSnapshot(farmId),
        ]);
        return {
            period: monthStart.toISOString().slice(0, 7),
            income: {
                current: income,
                previous: prevIncome,
                changePct: this.changePct(income, prevIncome),
            },
            expenses: {
                current: expense,
                previous: prevExpense,
                changePct: this.changePct(expense, prevExpense),
            },
            profit: {
                current: this.round(income - expense),
                previous: this.round(prevIncome - prevExpense),
                changePct: this.changePct(income - expense, prevIncome - prevExpense),
            },
            survivalRunway: {
                days: finance.survivalRunwayDays,
                availableLiquidity: finance.availableLiquidity,
                status: finance.survivalRunwayStatus,
            },
        };
    }
    async financialPerformance(farmId) {
        const months = this.lastNMonths(12);
        const rangeStart = months[0].start;
        const ledgerEntries = await this.prisma.journalEntry.findMany({
            where: {
                ledgerAccount: {
                    farmId,
                    category: {
                        in: [client_1.LedgerAccountCategory.REVENUE, client_1.LedgerAccountCategory.EXPENSE],
                    },
                },
                journalTransaction: { transactionDate: { gte: rangeStart } },
            },
            select: {
                debit: true,
                credit: true,
                ledgerAccount: { select: { category: true } },
                journalTransaction: { select: { transactionDate: true } },
            },
        });
        const buckets = new Map(months.map((m) => [m.key, { income: 0, expense: 0 }]));
        for (const e of ledgerEntries) {
            const key = this.monthKey(e.journalTransaction.transactionDate);
            const bucket = buckets.get(key);
            if (!bucket)
                continue;
            const debit = Number(e.debit);
            const credit = Number(e.credit);
            if (e.ledgerAccount.category === client_1.LedgerAccountCategory.REVENUE) {
                bucket.income += credit - debit;
            }
            else {
                bucket.expense += debit - credit;
            }
        }
        return {
            months: months.map((m) => {
                const b = buckets.get(m.key);
                const income = this.round(b.income);
                const expense = this.round(b.expense);
                return {
                    month: m.key,
                    label: m.label,
                    income,
                    expense,
                    profit: this.round(income - expense),
                };
            }),
        };
    }
    async productionVsFeedcost(farmId) {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
        const [milk, feed] = await Promise.all([
            this.prisma.milkLogEntry.findMany({
                where: { farmId, submitted: true, logDate: { gte: monthStart } },
                select: { logDate: true, yieldL: true },
            }),
            this.prisma.feedDistribution.findMany({
                where: { farmId, distributedAt: { gte: monthStart } },
                select: { distributedAt: true, totalActualCost: true },
            }),
        ]);
        const production = new Array(daysInMonth).fill(0);
        const feedcost = new Array(daysInMonth).fill(0);
        for (const m of milk) {
            const day = m.logDate.getUTCDate();
            if (day >= 1 && day <= daysInMonth)
                production[day - 1] += m.yieldL;
        }
        for (const f of feed) {
            const day = f.distributedAt.getUTCDate();
            if (day >= 1 && day <= daysInMonth)
                feedcost[day - 1] += f.totalActualCost;
        }
        return {
            days: Array.from({ length: daysInMonth }, (_, i) => ({
                day: i + 1,
                productionL: this.round(production[i]),
                feedcost: this.round(feedcost[i]),
            })),
        };
    }
    async conceptionRate(farmId) {
        const months = this.lastNMonths(12);
        const rangeStart = months[0].start;
        const history = await this.prisma.animalEvent.findMany({
            where: {
                farmId,
                type: 'BREEDING',
                provenance: 'HISTORICAL',
                status: 'ACTIVE',
            },
            select: { id: true },
        });
        const events = await this.prisma.breedingEvent.findMany({
            where: {
                breedingDate: { gte: rangeStart },
                cattle: (0, herd_scope_1.activeHerd)(farmId),
                voidedAt: null,
                OR: [
                    { animalEventId: null },
                    { animalEventId: { notIn: history.map((h) => h.id) } },
                ],
            },
            select: { breedingDate: true, status: true },
        });
        const buckets = new Map(months.map((m) => [m.key, { total: 0, confirmed: 0 }]));
        for (const e of events) {
            const bucket = buckets.get(this.monthKey(e.breedingDate));
            if (!bucket)
                continue;
            bucket.total += 1;
            if (e.status === 'PREGNANT')
                bucket.confirmed += 1;
        }
        return {
            months: months.map((m) => {
                const b = buckets.get(m.key);
                return {
                    month: m.key,
                    label: m.label,
                    inseminations: b.total,
                    confirmedPregnancies: b.confirmed,
                    ratePct: b.total
                        ? Math.round((b.confirmed / b.total) * 1000) / 10
                        : 0,
                };
            }),
        };
    }
    async feedStockAlerts(farmId) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS);
        const [medicines, feedItems, medicineUsage, feedMovements] = await Promise.all([
            this.prisma.medicine.findMany({
                where: { farmId, deletedAt: null, lowStockThreshold: { gt: 0 } },
                select: {
                    id: true,
                    name: true,
                    unit: { select: { symbol: true } },
                    currentStock: true,
                    lowStockThreshold: true,
                },
            }),
            this.prisma.feedItem.findMany({
                where: { farmId, deletedAt: null, lowStockThreshold: { gt: 0 } },
                select: {
                    id: true,
                    name: true,
                    unit: { select: { symbol: true } },
                    lowStockThreshold: true,
                    batches: {
                        where: { deletedAt: null },
                        select: { currentStock: true },
                    },
                },
            }),
            this.prisma.healthTask.groupBy({
                by: ['medicineId'],
                where: {
                    farmId,
                    medicineId: { not: null },
                    status: client_1.HealthTaskStatus.COMPLETED,
                    completedAt: { gte: thirtyDaysAgo },
                },
                _sum: { doseAmount: true },
            }),
            this.prisma.feedItemStockMovement.groupBy({
                by: ['feedItemId'],
                where: {
                    farmId,
                    createdAt: { gte: thirtyDaysAgo },
                    OR: [
                        { reason: 'DISTRIBUTION' },
                        { feedDistributionCattleItemId: { not: null } },
                    ],
                },
                _sum: { delta: true },
            }),
        ]);
        const feedConsumptionById = new Map(feedMovements.map((m) => [m.feedItemId, -(m._sum.delta ?? 0)]));
        const consumptionById = new Map(medicineUsage
            .filter((u) => u.medicineId != null)
            .map((u) => [u.medicineId, Number(u._sum.doseAmount ?? 0)]));
        const calcDaysRemaining = (consumption, id, stock) => {
            const total30d = consumption.get(id);
            if (!total30d || total30d <= 0)
                return null;
            const dailyRate = total30d / 30;
            return Math.floor(stock / dailyRate);
        };
        const feedItemsWithStock = feedItems.map((f) => ({
            ...f,
            currentStock: Math.round(f.batches.reduce((s, b) => s + b.currentStock, 0) * 1e6) /
                1e6,
        }));
        const toAlert = (type) => (i) => ({
            itemId: i.id,
            itemType: type,
            name: i.name,
            currentStock: i.currentStock,
            unit: i.unit.symbol,
            threshold: i.lowStockThreshold,
            daysRemainingEstimate: calcDaysRemaining(type === 'medicine' ? consumptionById : feedConsumptionById, i.id, i.currentStock),
            status: i.currentStock <= i.lowStockThreshold / 2 ? 'critical' : 'low',
        });
        const alerts = [
            ...medicines
                .filter((m) => m.currentStock <= m.lowStockThreshold)
                .map(toAlert('medicine')),
            ...feedItemsWithStock
                .filter((f) => f.currentStock <= f.lowStockThreshold)
                .map(toAlert('feed_item')),
        ];
        return { alerts };
    }
    async upcomingTasks(farmId) {
        const now = new Date();
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + DAY_MS);
        const todays = await this.prisma.task.findMany({
            where: { farmId, kind: 'TASK', dueAt: { gte: dayStart, lt: dayEnd } },
            orderBy: { dueAt: 'asc' },
            include: { assignedTo: { select: { name: true } } },
        });
        const overdue = todays.filter((t) => t.status !== client_1.TaskStatus.COMPLETED && t.dueAt.getTime() < now.getTime());
        const byCategory = {};
        for (const t of todays) {
            const key = t.category.toLowerCase();
            const row = byCategory[key] ?? { count: 0, overdue: 0 };
            row.count += 1;
            if (t.status !== client_1.TaskStatus.COMPLETED &&
                t.dueAt.getTime() < now.getTime()) {
                row.overdue += 1;
            }
            byCategory[key] = row;
        }
        return {
            totalToday: todays.length,
            completedToday: todays.filter((t) => t.status === client_1.TaskStatus.COMPLETED)
                .length,
            overdue: overdue.length,
            byCategory,
            tasks: todays.map((t) => ({
                id: t.id,
                name: t.name,
                category: t.category,
                priority: t.priority,
                dueAt: t.dueAt,
                status: t.status,
                assignedTo: t.assignedTo?.name ?? null,
            })),
        };
    }
    async priorities(farmId) {
        const now = new Date();
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + DAY_MS);
        const calvingHorizon = new Date(now.getTime() + 3 * DAY_MS);
        const [overdueDoseCattle, soonCalving, lowMed, overdueRecV2, dueTasks, completedTasks,] = await Promise.all([
            this.prisma.healthTask.findMany({
                where: {
                    farmId,
                    deletedAt: null,
                    status: { in: [client_1.HealthTaskStatus.PENDING, client_1.HealthTaskStatus.OVERDUE] },
                    dueDateTime: { lt: now },
                },
                select: {
                    cattle: { select: { id: true, name: true, tagNumber: true } },
                },
                distinct: ['cattleId'],
                orderBy: { dueDateTime: 'asc' },
                take: PRIORITY_CATTLE_LIMIT + 1,
            }),
            this.prisma.pregnancy.findFirst({
                where: {
                    status: client_1.PregnancyStatus.ACTIVE,
                    expectedCalvingDate: { gte: now, lte: calvingHorizon },
                    cattle: (0, herd_scope_1.activeHerd)(farmId),
                },
                orderBy: { expectedCalvingDate: 'asc' },
                include: {
                    cattle: { select: { id: true, name: true, tagNumber: true } },
                },
            }),
            this.prisma.medicine.findFirst({
                where: {
                    farmId,
                    deletedAt: null,
                    lowStockThreshold: { gt: 0 },
                    currentStock: { lte: this.prisma.medicine.fields.lowStockThreshold },
                },
                orderBy: { currentStock: 'asc' },
                include: { unit: true },
            }),
            this.prisma.receivable.findFirst({
                where: { farmId, dueDate: { lt: now }, closedAt: null },
                orderBy: { dueDate: 'asc' },
                select: {
                    id: true,
                    totalAmount: true,
                    dueDate: true,
                    sale: { select: { saleNumber: true } },
                },
            }),
            this.prisma.task.count({
                where: { farmId, kind: 'TASK', dueAt: { gte: dayStart, lt: dayEnd } },
            }),
            this.prisma.task.count({
                where: {
                    farmId,
                    kind: 'TASK',
                    status: client_1.TaskStatus.COMPLETED,
                    dueAt: { gte: dayStart, lt: dayEnd },
                },
            }),
        ]);
        const priorities = [];
        if (overdueDoseCattle.length > 0) {
            const overdueTruncated = overdueDoseCattle.length > PRIORITY_CATTLE_LIMIT;
            const overdueShown = overdueDoseCattle.slice(0, PRIORITY_CATTLE_LIMIT);
            const overdueCount = overdueTruncated
                ? PRIORITY_CATTLE_LIMIT
                : overdueDoseCattle.length;
            priorities.push({
                priority: 'critical',
                icon: '🔴',
                message: `${overdueCount}${overdueTruncated ? '+' : ''} cow(s) overdue for treatment dose`,
                actionLabel: 'Log now',
                link: '/healthcare?healthTab=sickBay',
                count: overdueCount,
                cattle: overdueShown.map((d) => ({
                    id: d.cattle.id,
                    name: d.cattle.name,
                    tag: d.cattle.tagNumber,
                })),
                truncated: overdueTruncated,
            });
        }
        if (soonCalving?.expectedCalvingDate) {
            const days = Math.max(0, Math.ceil((soonCalving.expectedCalvingDate.getTime() - now.getTime()) / DAY_MS));
            priorities.push({
                priority: 'urgent',
                icon: '🟠',
                message: `${soonCalving.cattle.name ?? soonCalving.cattle.tagNumber} expected to calve in ${days} day(s)`,
                actionLabel: 'Prepare calving kit',
                link: `/reproduction/calving/${soonCalving.cattleId}`,
                cattleId: soonCalving.cattleId,
                expectedDate: soonCalving.expectedCalvingDate,
            });
        }
        if (lowMed) {
            priorities.push({
                priority: 'important',
                icon: '🟡',
                message: `${lowMed.name} stock: ${lowMed.currentStock} ${lowMed.unit.symbol} remaining (low)`,
                actionLabel: 'Reorder',
                link: `/inventory/medicines/${lowMed.id}`,
                count: lowMed.currentStock,
            });
        }
        let overdueRec = null;
        if (overdueRecV2) {
            const allocated = await this.prisma.paymentAllocation.aggregate({
                where: { receivableId: overdueRecV2.id },
                _sum: { amount: true },
            });
            const outstanding = (0, txn_filters_1.deriveOutstanding)(overdueRecV2.totalAmount, allocated._sum.amount ?? 0);
            if (outstanding > 0) {
                overdueRec = {
                    id: overdueRecV2.id,
                    entityName: overdueRecV2.sale.saleNumber,
                    outstanding,
                    dueDate: overdueRecV2.dueDate,
                };
            }
        }
        if (overdueRec) {
            const daysOver = Math.floor((now.getTime() - overdueRec.dueDate.getTime()) / DAY_MS);
            priorities.push({
                priority: 'important',
                icon: '🟡',
                message: `${overdueRec.entityName} payment: Tk ${overdueRec.outstanding} overdue by ${daysOver} day(s)`,
                actionLabel: 'Follow up',
                link: `/finance/receivables/${overdueRec.id}`,
            });
        }
        const pendingMilkCattle = await this.pendingMilkCattle(farmId, dayStart, dayEnd);
        if (pendingMilkCattle.length > 0) {
            const pendingTruncated = pendingMilkCattle.length > PRIORITY_CATTLE_LIMIT;
            priorities.push({
                priority: 'operational',
                icon: '🟢',
                message: `Milk log pending — ${pendingMilkCattle.length} cow(s) not yet logged`,
                actionLabel: 'Log milk',
                link: '/milk?session=morning',
                count: pendingMilkCattle.length,
                cattle: pendingMilkCattle.slice(0, PRIORITY_CATTLE_LIMIT),
                truncated: pendingTruncated,
            });
        }
        if (dueTasks > 0) {
            priorities.push({
                priority: 'routine',
                icon: '⚪',
                message: `${dueTasks} task(s) due today — ${completedTasks} completed`,
                actionLabel: 'View tasks',
                link: '/tasks',
            });
        }
        return { priorities: priorities.slice(0, 7) };
    }
    async pendingMilkCattle(farmId, dayStart, dayEnd) {
        const [milkingCows, logged] = await Promise.all([
            this.prisma.cattle.findMany({
                where: {
                    ...(0, herd_scope_1.activeHerd)(farmId),
                    gender: client_1.CattleGender.FEMALE,
                    productionStatus: { not: client_1.ProductionStatus.DRY },
                },
                select: { id: true, name: true, tagNumber: true },
            }),
            this.prisma.milkLogEntry.findMany({
                where: { farmId, logDate: { gte: dayStart, lt: dayEnd } },
                select: { cattleId: true },
                distinct: ['cattleId'],
            }),
        ]);
        const loggedIds = new Set(logged.map((l) => l.cattleId));
        return milkingCows
            .filter((c) => !loggedIds.has(c.id))
            .map((c) => ({ id: c.id, name: c.name, tag: c.tagNumber }));
    }
    async txnSum(farmId, revenue, from, to) {
        const v2 = await (0, txn_filters_1.ledgerCategoryNet)(this.prisma, farmId, revenue ? client_1.LedgerAccountCategory.REVENUE : client_1.LedgerAccountCategory.EXPENSE, { gte: from, lt: to });
        return this.round(v2);
    }
    async financeSnapshot(farmId) {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const [rakhalBalance, monthExpense, sellable, thresholds] = await Promise.all([
            this.balance.getRakhalBalance(farmId),
            (0, txn_filters_1.ledgerCategoryNet)(this.prisma, farmId, client_1.LedgerAccountCategory.EXPENSE, {
                gte: monthStart,
                lt: now,
            }),
            this.prisma.milkLogEntry.aggregate({
                where: {
                    farmId,
                    tankType: client_1.MilkTankType.SELLABLE,
                    submitted: true,
                    logDate: { gte: monthStart, lte: now },
                },
                _sum: { yieldL: true },
            }),
            this.farmSettings.financeRunwayThresholds(farmId),
        ]);
        const liquidity = Number(rakhalBalance.rakhalBalance);
        const sellableLitres = sellable._sum.yieldL ?? 0;
        const costPerLitreThisMonth = sellableLitres > 0 ? this.round(monthExpense / sellableLitres) : null;
        const runway = await (0, runway_1.computeRunwaySnapshot)(this.prisma, farmId, liquidity, thresholds, now);
        return {
            availableLiquidity: this.round(liquidity),
            costPerLitreThisMonth,
            survivalRunwayDays: runway.days,
            survivalRunwayStatus: runway.status,
        };
    }
    calfStageCounts(dobs, now) {
        const counts = {
            total: dobs.length,
            newborn_0_7: 0,
            young_7_60: 0,
            pre_weaning_60_90: 0,
            post_weaning_90plus: 0,
        };
        for (const dob of dobs) {
            if (!dob)
                continue;
            const age = Math.floor((now.getTime() - dob.getTime()) / DAY_MS);
            if (age < 7)
                counts.newborn_0_7 += 1;
            else if (age < 60)
                counts.young_7_60 += 1;
            else if (age < 90)
                counts.pre_weaning_60_90 += 1;
            else
                counts.post_weaning_90plus += 1;
        }
        return counts;
    }
    periodRange(period) {
        const now = new Date();
        if (period === 'week')
            return { gte: new Date(now.getTime() - 7 * DAY_MS) };
        return { gte: new Date(now.getTime() - 30 * DAY_MS) };
    }
    changePct(current, previous) {
        if (!previous)
            return null;
        return Math.round(((current - previous) / previous) * 1000) / 10;
    }
    round(n) {
        return Math.round(n * 100) / 100;
    }
    monthKey(d) {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    lastNMonths(n) {
        const now = new Date();
        const labels = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
        ];
        const months = [];
        for (let i = n - 1; i >= 0; i -= 1) {
            const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
            months.push({
                key: this.monthKey(start),
                label: labels[start.getUTCMonth()],
                start,
            });
        }
        return months;
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = DashboardService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        balance_service_1.BalanceService,
        milk_service_1.MilkService,
        health_service_1.HealthService,
        farm_settings_service_1.FarmSettingsService,
        feed_distribution_service_1.FeedDistributionService,
        cache_service_1.CacheService,
        logger_service_1.LoggerService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map