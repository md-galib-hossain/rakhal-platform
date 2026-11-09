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
var MilkService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MilkService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const aqr_service_1 = require("src/modules/activity/application/services/aqr.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const milk_tank_service_1 = require("src/modules/inventory/application/services/milk-tank.service");
const farm_settings_service_1 = require("src/modules/farm-settings/farm-settings.service");
const health_service_1 = require("src/modules/health/application/services/health.service");
const animal_hold_service_1 = require("src/modules/cattle/application/services/animal-hold.service");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const milk_anomaly_1 = require("../../domain/milk-anomaly");
const milk_disposition_1 = require("../../domain/milk-disposition");
const milk_eligibility_1 = require("../../domain/milk-eligibility");
const lactation_curve_1 = require("src/modules/reproduction/domain/lactation-curve");
const lactation_yield_1 = require("src/modules/reproduction/domain/lactation-yield");
const pagination_1 = require("src/common/pagination");
const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_RANGE_DAYS = {
    '7d': 7,
    '30d': 30,
    '3m': 90,
    '6m': 180,
    '1y': 365,
    lifetime: null,
};
let MilkService = MilkService_1 = class MilkService {
    prisma;
    aqrService;
    activityLog;
    milkTankService;
    farmSettings;
    healthService;
    animalHoldService;
    clock;
    log;
    constructor(prisma, aqrService, activityLog, milkTankService, farmSettings, healthService, animalHoldService, logger, clock) {
        this.prisma = prisma;
        this.aqrService = aqrService;
        this.activityLog = activityLog;
        this.milkTankService = milkTankService;
        this.farmSettings = farmSettings;
        this.healthService = healthService;
        this.animalHoldService = animalHoldService;
        this.clock = clock;
        this.log = logger.setContext(MilkService_1.name);
    }
    async overview(farmId, dateStr, range) {
        const day = dateStr
            ? this.normalizeDate(dateStr)
            : await this.clock.todayStart(farmId);
        const [today, yesterday, lastWeek, lastYear, sessions, trend, milkPrice] = await Promise.all([
            this.dayBreakdown(farmId, day),
            this.dayTotal(farmId, this.shiftDays(day, -1)),
            this.dayTotal(farmId, this.shiftDays(day, -7)),
            this.dayTotal(farmId, this.shiftDays(day, -365)),
            this.sessionStatuses(farmId, day),
            this.trend(farmId, day, TREND_RANGE_DAYS[range ?? '30d']),
            this.estimatedMilkPricePerLitre(farmId),
        ]);
        return {
            date: this.dateOnly(day),
            today,
            yesterday: { totalL: yesterday },
            sameDayLastWeek: { totalL: lastWeek },
            sameDayLastYear: { totalL: lastYear },
            costPerLitreToday: null,
            marketValueToday: milkPrice != null
                ? Math.round(today.sellableL * milkPrice * 100) / 100
                : null,
            sessionsStatus: sessions,
            trendRange: range ?? '30d',
            trend,
        };
    }
    async estimatedMilkPricePerLitre(farmId) {
        const { _avg } = await this.prisma.milkBuyer.aggregate({
            where: { farmId, deletedAt: null },
            _avg: { basePricePerLitre: true },
        });
        return _avg.basePricePerLitre ?? null;
    }
    async logTable(farmId, query) {
        const day = query.date
            ? this.normalizeDate(query.date)
            : await this.clock.todayStart(farmId);
        const cows = await this.prisma.cattle.findMany({
            where: {
                ...(0, herd_scope_1.activeHerd)(farmId),
                gender: client_1.CattleGender.FEMALE,
                productionStatus: { not: client_1.ProductionStatus.DRY },
                ...(query.shedId ? { shedId: query.shedId } : {}),
            },
            orderBy: { tagNumber: 'asc' },
            include: { shed: { select: { name: true } } },
        });
        const ids = cows.map((c) => c.id);
        const [entries, withholding, avg7d, prevDay] = await Promise.all([
            this.prisma.milkLogEntry.findMany({
                where: { farmId, logDate: day, cattleId: { in: ids } },
            }),
            this.activeWithholding(farmId, ids),
            this.avgDailyYield(farmId, ids, day),
            this.prevDayYield(farmId, ids, day),
        ]);
        const byCow = new Map();
        for (const e of entries) {
            const list = byCow.get(e.cattleId) ?? [];
            list.push(e);
            byCow.set(e.cattleId, list);
        }
        const rows = cows.map((cow) => {
            const cowEntries = byCow.get(cow.id) ?? [];
            const isWithholding = withholding.has(cow.id);
            const sessionYield = (s) => cowEntries.find((e) => e.session === s)?.yieldL ?? null;
            const total = cowEntries.reduce((sum, e) => sum + e.yieldL, 0);
            return {
                cattleId: cow.id,
                name: cow.name,
                tag: cow.tagNumber,
                shed: cow.shed?.name ?? null,
                avgYield7d: avg7d.get(cow.id) ?? null,
                prevDayYieldL: prevDay.get(cow.id) ?? null,
                productionStatus: 'milking',
                withholding: isWithholding,
                log: {
                    morningL: sessionYield(client_1.MilkSession.MORNING),
                    noonL: sessionYield(client_1.MilkSession.NOON),
                    eveningL: sessionYield(client_1.MilkSession.EVENING),
                    nightL: sessionYield(client_1.MilkSession.NIGHT),
                    totalL: Math.round(total * 10) / 10,
                    tank: isWithholding
                        ? client_1.MilkTankType.WITHHOLDING
                        : client_1.MilkTankType.SELLABLE,
                    tankLocked: isWithholding,
                    tankId: cowEntries.find((e) => e.tankId)?.tankId ?? null,
                    anomalyFlag: cowEntries.some((e) => e.anomalyFlag),
                    submittedSessions: cowEntries
                        .filter((e) => e.submitted)
                        .map((e) => e.session),
                    dispositions: Object.fromEntries(cowEntries.map((e) => [e.session, e.disposition])),
                },
            };
        });
        return {
            date: this.dateOnly(day),
            sessionConfig: await this.farmSettings.milkActiveSessions(farmId),
            entries: rows,
        };
    }
    async getMilkEligibility(farmId, cattleId) {
        const [withholdingIds, activeLactation, colostrumWindowDays, discardHolds] = await Promise.all([
            this.healthService.activeMilkWithholdingCattleIds(farmId, [cattleId]),
            this.prisma.lactation.findFirst({
                where: { cattleId, endDate: null, cattle: { farmId } },
                select: { startDate: true },
            }),
            this.farmSettings.milkColostrumWindowDays(farmId),
            this.animalHoldService.activeHoldsForCattle(farmId, cattleId, 'MILK_DISCARD'),
        ]);
        return (0, milk_eligibility_1.deriveMilkEligibility)({
            isWithheld: withholdingIds.has(cattleId),
            isInColostrumWindow: (0, milk_disposition_1.isWithinColostrumWindow)({
                activeLactationStartDate: activeLactation?.startDate ?? null,
                asOfDate: new Date(),
                colostrumWindowDays,
            }),
            hasDiscardRequiredHold: discardHolds.length > 0,
        });
    }
    async saveLog(farmId, userId, dto) {
        await this.assertSessionActive(farmId, dto.session);
        const logDate = this.normalizeDate(dto.date);
        const ids = dto.entries.map((e) => e.cattleId);
        const cows = await this.prisma.cattle.findMany({
            where: { id: { in: ids }, ...(0, herd_scope_1.activeHerd)(farmId) },
            select: { id: true },
        });
        const valid = new Set(cows.map((c) => c.id));
        const missing = ids.find((id) => !valid.has(id));
        if (missing) {
            throw new common_1.BadRequestException(`Cattle ${missing} does not belong to this farm, is not in the active herd, or has been deleted`);
        }
        const from = this.shiftDays(logDate, -7);
        const [withholding, avgRows, existingEntries, activeLactations, colostrumWindowDays,] = await Promise.all([
            this.activeWithholding(farmId, ids),
            this.prisma.milkLogEntry.groupBy({
                by: ['cattleId'],
                where: {
                    farmId,
                    session: dto.session,
                    submitted: true,
                    cattleId: { in: ids },
                    logDate: { gte: from, lt: logDate },
                },
                _avg: { yieldL: true },
            }),
            this.prisma.milkLogEntry.findMany({
                where: { farmId, logDate, session: dto.session, cattleId: { in: ids } },
            }),
            this.prisma.lactation.findMany({
                where: { cattleId: { in: ids }, endDate: null },
                select: { id: true, cattleId: true, startDate: true },
            }),
            this.farmSettings.milkColostrumWindowDays(farmId),
        ]);
        const avgMap = new Map(avgRows.map((r) => [r.cattleId, r._avg.yieldL]));
        const existingByCow = new Map(existingEntries.map((e) => [e.cattleId, e]));
        const anomalyFraction = await this.farmSettings.milkAnomalyFraction(farmId);
        const lactationStartByCow = new Map(activeLactations.map((l) => [l.cattleId, l.startDate]));
        const activeLactationIdByCow = new Map(activeLactations.map((l) => [l.cattleId, l.id]));
        const tankIds = [
            ...new Set(dto.entries.map((e) => e.tankId).filter((id) => !!id)),
        ];
        const tanks = tankIds.length
            ? await this.prisma.milkTank.findMany({
                where: { id: { in: tankIds }, farmId, deletedAt: null },
            })
            : [];
        const tankById = new Map(tanks.map((t) => [t.id, t]));
        const missingTank = tankIds.find((id) => !tankById.has(id));
        if (missingTank) {
            throw new common_1.BadRequestException(`Milk tank ${missingTank} not found for this farm`);
        }
        let anomaliesFlagged = 0;
        let sessionTotal = 0;
        await this.prisma.$transaction(async (tx) => {
            for (const entry of dto.entries) {
                const isWithheld = withholding.has(entry.cattleId);
                const tankType = isWithheld
                    ? client_1.MilkTankType.WITHHOLDING
                    : client_1.MilkTankType.SELLABLE;
                const disposition = (0, milk_disposition_1.resolveMilkDisposition)({
                    isWithheld,
                    activeLactationStartDate: lactationStartByCow.get(entry.cattleId) ?? null,
                    logDate,
                    colostrumWindowDays,
                });
                if (entry.tankId) {
                    const tank = tankById.get(entry.tankId);
                    if (tank.tankType !== tankType) {
                        throw new common_1.BadRequestException(`Selected tank does not match the ${tankType.toLowerCase()} requirement for cattle ${entry.cattleId}`);
                    }
                }
                const anomalyFlag = (0, milk_anomaly_1.isAnomaly)(entry.yieldL, avgMap.get(entry.cattleId) ?? null, anomalyFraction);
                if (anomalyFlag)
                    anomaliesFlagged += 1;
                sessionTotal += entry.yieldL;
                const newTankId = entry.tankId ?? null;
                const existing = existingByCow.get(entry.cattleId);
                await tx.milkLogEntry.upsert({
                    where: {
                        cattleId_logDate_session: {
                            cattleId: entry.cattleId,
                            logDate,
                            session: dto.session,
                        },
                    },
                    create: {
                        farmId,
                        cattleId: entry.cattleId,
                        logDate,
                        session: dto.session,
                        yieldL: entry.yieldL,
                        tankType,
                        disposition,
                        tankId: newTankId,
                        anomalyFlag,
                        anomalyNote: entry.anomalyNote,
                        editReason: entry.editReason ?? null,
                        createdBy: userId,
                    },
                    update: {
                        yieldL: entry.yieldL,
                        tankType,
                        disposition,
                        tankId: newTankId,
                        anomalyFlag,
                        anomalyNote: entry.anomalyNote,
                        editReason: entry.editReason ?? null,
                    },
                });
                if (existing?.submitted &&
                    (existing.yieldL !== entry.yieldL ||
                        existing.tankId !== newTankId ||
                        existing.tankType !== tankType)) {
                    await this.collectInto(farmId, userId, existing.tankType, existing.tankId, -existing.yieldL, dto.session, tx, client_1.MilkTankActivity.ADJUSTMENT);
                    await this.collectInto(farmId, userId, tankType, newTankId, entry.yieldL, dto.session, tx, client_1.MilkTankActivity.ADJUSTMENT);
                }
            }
            const cowsToRecompute = new Set(dto.entries
                .map((e) => activeLactationIdByCow.get(e.cattleId))
                .filter((id) => !!id));
            for (const lactationId of cowsToRecompute) {
                await this.recomputeLactationPeak(farmId, lactationId, tx);
            }
        });
        this.log.info('Milk log saved', {
            farmId,
            session: dto.session,
            count: dto.entries.length,
        });
        return {
            saved: dto.entries.length,
            anomaliesFlagged,
            sessionTotalL: Math.round(sessionTotal * 10) / 10,
        };
    }
    async submit(farmId, userId, dto) {
        await this.assertSessionActive(farmId, dto.session);
        const logDate = this.normalizeDate(dto.date);
        const pending = await this.prisma.milkLogEntry.findMany({
            where: { farmId, logDate, session: dto.session, submitted: false },
            include: {
                cattle: { select: { id: true, name: true, tagNumber: true } },
            },
        });
        if (pending.length === 0) {
            throw new common_1.BadRequestException('No new milk log entries to submit for this session');
        }
        const sellableTotal = this.sum(pending, client_1.MilkTankType.SELLABLE);
        const withholdingTotal = this.sum(pending, client_1.MilkTankType.WITHHOLDING);
        const groups = new Map();
        for (const entry of pending) {
            const key = entry.tankId ?? `type:${entry.tankType}`;
            const g = groups.get(key) ?? {
                tankType: entry.tankType,
                tankId: entry.tankId,
                volume: 0,
            };
            g.volume += entry.yieldL;
            groups.set(key, g);
        }
        const { mainUpdated, withholdingUpdated } = await this.prisma.$transaction(async (tx) => {
            await tx.milkLogEntry.updateMany({
                where: { farmId, logDate, session: dto.session, submitted: false },
                data: { submitted: true, submittedAt: new Date() },
            });
            let mainUpdated = false;
            let withholdingUpdated = false;
            for (const group of groups.values()) {
                const updated = await this.collectInto(farmId, userId, group.tankType, group.tankId, Math.round(group.volume * 10) / 10, dto.session, tx);
                if (updated && group.tankType === client_1.MilkTankType.SELLABLE) {
                    mainUpdated = true;
                }
                if (updated && group.tankType === client_1.MilkTankType.WITHHOLDING) {
                    withholdingUpdated = true;
                }
            }
            return { mainUpdated, withholdingUpdated };
        });
        for (const entry of pending) {
            await this.aqrService.applyEvent(farmId, entry.cattleId, 'milk_session_logged', {
                actorId: userId,
            });
        }
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.MILK_PRODUCTION,
            eventTitle: 'Milk Session Submitted',
            actionDetails: `Milk Session [${dto.session.toLowerCase()}] logged — ${sellableTotal}L sellable / ${withholdingTotal}L withholding.`,
            actorId: userId,
        });
        this.log.info('Milk session submitted', {
            farmId,
            session: dto.session,
            sellableTotal,
            withholdingTotal,
        });
        return {
            date: this.dateOnly(logDate),
            session: dto.session,
            totalCowsLogged: pending.length,
            sellableTotalL: sellableTotal,
            withholdingTotalL: withholdingTotal,
            mainTankUpdated: mainUpdated,
            withholdingTankUpdated: withholdingUpdated,
            activityLogCreated: true,
            anomalies: pending
                .filter((e) => e.anomalyFlag)
                .map((e) => ({
                cattleId: e.cattleId,
                name: e.cattle.name ?? e.cattle.tagNumber,
                yieldL: e.yieldL,
            })),
        };
    }
    async logCalendar(farmId, month) {
        const [year, m] = month.split('-').map(Number);
        const from = new Date(Date.UTC(year, m - 1, 1));
        const to = new Date(Date.UTC(year, m, 1));
        const today = await this.clock.todayStart(farmId);
        const [farm, activeSessions, rows] = await Promise.all([
            this.prisma.farm.findUnique({
                where: { id: farmId },
                select: { createdAt: true },
            }),
            this.farmSettings.milkActiveSessions(farmId),
            this.prisma.milkLogEntry.groupBy({
                by: ['logDate', 'session'],
                where: { farmId, logDate: { gte: from, lt: to } },
            }),
        ]);
        const farmCreatedDay = farm
            ? this.normalizeDate(farm.createdAt.toISOString())
            : null;
        const sessionsByDay = new Map();
        for (const row of rows) {
            const key = this.dateOnly(row.logDate);
            const set = sessionsByDay.get(key) ?? new Set();
            set.add(row.session);
            sessionsByDay.set(key, set);
        }
        const days = [];
        for (let d = new Date(from); d < to; d = this.shiftDays(d, 1)) {
            const dateStr = this.dateOnly(d);
            let status;
            if (d.getTime() > today.getTime()) {
                status = 'future';
            }
            else if (farmCreatedDay && d.getTime() < farmCreatedDay.getTime()) {
                status = 'before_farm';
            }
            else if (activeSessions.length === 0) {
                status = 'missing';
            }
            else {
                const logged = sessionsByDay.get(dateStr)?.size ?? 0;
                status =
                    logged === 0
                        ? 'missing'
                        : logged < activeSessions.length
                            ? 'partial'
                            : 'complete';
            }
            days.push({ date: dateStr, status });
        }
        return { month, days };
    }
    async anomalies(farmId, query) {
        const where = {
            farmId,
            anomalyFlag: true,
            ...(query.date ? { logDate: this.normalizeDate(query.date) } : {}),
        };
        const rows = await this.prisma.milkLogEntry.findMany({
            where,
            orderBy: [
                { logDate: query.sortOrder },
                { createdAt: query.sortOrder },
                { id: query.sortOrder },
            ],
            include: {
                cattle: { select: { id: true, name: true, tagNumber: true } },
            },
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        const anomalies = await Promise.all(page.items.map(async (row) => {
            const avg = await this.sessionAvg(farmId, row.cattleId, row.session, row.logDate);
            return {
                id: row.id,
                cattleId: row.cattleId,
                name: row.cattle.name ?? row.cattle.tagNumber,
                tag: row.cattle.tagNumber,
                date: this.dateOnly(row.logDate),
                session: row.session,
                yieldL: row.yieldL,
                avg7dL: avg,
                dropPct: (0, milk_anomaly_1.dropPct)(row.yieldL, avg),
                workerNote: row.anomalyNote,
                reviewed: row.reviewed,
            };
        }));
        return { items: anomalies, meta: page.meta };
    }
    async reviewAnomaly(farmId, id, dto) {
        const entry = await this.prisma.milkLogEntry.findFirst({
            where: { id, farmId },
        });
        if (!entry)
            throw new common_1.NotFoundException('Milk log entry not found');
        if (!entry.anomalyFlag) {
            throw new common_1.BadRequestException('Entry is not flagged as an anomaly');
        }
        const updated = await this.prisma.milkLogEntry.update({
            where: { id },
            data: { reviewed: true, reviewAction: dto.action, reviewNote: dto.notes },
        });
        this.log.info('Milk anomaly reviewed', { entryId: id, farmId });
        return updated;
    }
    async assertSessionActive(farmId, session) {
        const active = await this.farmSettings.milkActiveSessions(farmId);
        if (!active.includes(session)) {
            throw new common_1.BadRequestException(`The ${session.toLowerCase()} session is not enabled for this farm`);
        }
    }
    async collectInto(farmId, userId, tankType, tankIdOverride, volume, session, tx, activityType = client_1.MilkTankActivity.COLLECTION) {
        if (volume === 0)
            return false;
        let tank = tankIdOverride
            ? await tx.milkTank.findFirst({
                where: { id: tankIdOverride, farmId, tankType, deletedAt: null },
            })
            : await tx.milkTank.findFirst({
                where: { farmId, tankType, deletedAt: null },
                orderBy: { createdAt: 'asc' },
            });
        if (!tank &&
            !tankIdOverride &&
            volume > 0 &&
            tankType === client_1.MilkTankType.SELLABLE) {
            tank = await this.milkTankService.ensureDefaultSellableTank(farmId, userId, tx);
        }
        if (!tank)
            return false;
        await this.milkTankService.adjustVolume(farmId, userId, tank.id, {
            delta: volume,
            activityType,
            source: activityType === client_1.MilkTankActivity.ADJUSTMENT
                ? 'milk_log_edit'
                : 'milk_log_submission',
            notes: activityType === client_1.MilkTankActivity.ADJUSTMENT
                ? `Session ${session.toLowerCase()} — entry edited after submit`
                : `Session ${session.toLowerCase()}`,
        }, tx);
        return true;
    }
    async recomputeLactationPeak(farmId, lactationId, tx) {
        const lactation = await tx.lactation.findFirst({
            where: { id: lactationId, cattle: { farmId } },
            select: { id: true, cattleId: true, startDate: true, endDate: true },
        });
        if (!lactation)
            return;
        const rangeEnd = lactation.endDate ?? new Date();
        const entries = await tx.milkLogEntry.findMany({
            where: {
                cattleId: lactation.cattleId,
                logDate: { gte: lactation.startDate, lte: rangeEnd },
            },
            select: { logDate: true, session: true, yieldL: true },
        });
        const curveEntries = entries;
        const configuredSessions = await this.farmSettings.milkActiveSessions(farmId);
        const expectedSessions = configuredSessions.length > 0
            ? configuredSessions
            : milk_anomaly_1.DEFAULT_SESSION_CONFIG;
        const series = (0, lactation_curve_1.buildDailyYieldSeries)({
            startDate: lactation.startDate,
            endDate: rangeEnd,
            entries: curveEntries,
            expectedSessions,
        });
        const peak = (0, lactation_yield_1.computeLactationPeak)(series);
        if (!peak)
            return;
        await tx.lactation.update({
            where: { id: lactation.id },
            data: {
                peakMilkYield: peak.peakMilkYield,
                peakMilkDate: peak.peakMilkDate,
                peakDaysInMilk: peak.peakDaysInMilk,
            },
        });
    }
    activeWithholding(farmId, ids) {
        return this.healthService.activeMilkWithholdingCattleIds(farmId, ids);
    }
    async averageDailyYield(farmId, cattleIds, asOf = new Date()) {
        return this.avgDailyYield(farmId, cattleIds, asOf);
    }
    async avgDailyYield(farmId, ids, day) {
        if (ids.length === 0)
            return new Map();
        const from = this.shiftDays(day, -7);
        const rows = await this.prisma.milkLogEntry.groupBy({
            by: ['cattleId'],
            where: {
                farmId,
                submitted: true,
                cattleId: { in: ids },
                logDate: { gte: from, lt: day },
            },
            _sum: { yieldL: true },
        });
        return new Map(rows.map((r) => [
            r.cattleId,
            Math.round(((r._sum.yieldL ?? 0) / 7) * 10) / 10,
        ]));
    }
    async prevDayYield(farmId, ids, day) {
        if (ids.length === 0)
            return new Map();
        const prevDay = this.shiftDays(day, -1);
        const rows = await this.prisma.milkLogEntry.groupBy({
            by: ['cattleId'],
            where: {
                farmId,
                submitted: true,
                cattleId: { in: ids },
                logDate: prevDay,
            },
            _sum: { yieldL: true },
        });
        return new Map(rows.map((r) => [r.cattleId, Math.round((r._sum.yieldL ?? 0) * 10) / 10]));
    }
    async sessionAvg(farmId, cattleId, session, before) {
        const from = this.shiftDays(before, -7);
        const agg = await this.prisma.milkLogEntry.aggregate({
            where: {
                farmId,
                cattleId,
                session,
                submitted: true,
                logDate: { gte: from, lt: before },
            },
            _avg: { yieldL: true },
        });
        return agg._avg.yieldL == null
            ? null
            : Math.round(agg._avg.yieldL * 10) / 10;
    }
    async dayBreakdown(farmId, day) {
        const rows = await this.prisma.milkLogEntry.groupBy({
            by: ['tankType'],
            where: { farmId, logDate: day, submitted: true },
            _sum: { yieldL: true },
        });
        const byType = new Map(rows.map((r) => [r.tankType, r._sum.yieldL ?? 0]));
        const sellableL = Math.round((byType.get(client_1.MilkTankType.SELLABLE) ?? 0) * 10) / 10;
        const withholdingL = Math.round((byType.get(client_1.MilkTankType.WITHHOLDING) ?? 0) * 10) / 10;
        return {
            totalL: Math.round((sellableL + withholdingL) * 10) / 10,
            sellableL,
            withholdingL,
            calfL: 0,
        };
    }
    async dayTotal(farmId, day) {
        const agg = await this.prisma.milkLogEntry.aggregate({
            where: { farmId, logDate: day, submitted: true },
            _sum: { yieldL: true },
        });
        return Math.round((agg._sum.yieldL ?? 0) * 10) / 10;
    }
    async sessionStatuses(farmId, day) {
        const [rows, activeSessions] = await Promise.all([
            this.prisma.milkLogEntry.groupBy({
                by: ['session', 'submitted'],
                where: { farmId, logDate: day },
                _count: { _all: true },
            }),
            this.farmSettings.milkActiveSessions(farmId),
        ]);
        const status = {};
        for (const session of Object.values(client_1.MilkSession)) {
            if (!activeSessions.includes(session)) {
                status[session.toLowerCase()] = 'not_configured';
                continue;
            }
            const submitted = rows.some((r) => r.session === session && r.submitted);
            const draft = rows.some((r) => r.session === session && !r.submitted);
            status[session.toLowerCase()] = submitted
                ? 'submitted'
                : draft
                    ? 'pending'
                    : 'pending';
        }
        return status;
    }
    async trend(farmId, day, days) {
        const from = days == null ? null : this.shiftDays(day, -(days - 1));
        const rows = await this.prisma.milkLogEntry.groupBy({
            by: ['logDate'],
            where: {
                farmId,
                submitted: true,
                logDate: from == null ? { lte: day } : { gte: from, lte: day },
            },
            _sum: { yieldL: true },
        });
        return rows
            .map((r) => ({
            date: this.dateOnly(r.logDate),
            totalL: Math.round((r._sum.yieldL ?? 0) * 10) / 10,
        }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
    sum(entries, tankType) {
        const total = entries
            .filter((e) => e.tankType === tankType)
            .reduce((acc, e) => acc + e.yieldL, 0);
        return Math.round(total * 10) / 10;
    }
    normalizeDate(dateStr) {
        return new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
    }
    shiftDays(day, delta) {
        return new Date(day.getTime() + delta * DAY_MS);
    }
    dateOnly(day) {
        return day.toISOString().slice(0, 10);
    }
};
exports.MilkService = MilkService;
exports.MilkService = MilkService = MilkService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        aqr_service_1.AqrService,
        activity_log_service_1.ActivityLogService,
        milk_tank_service_1.MilkTankService,
        farm_settings_service_1.FarmSettingsService,
        health_service_1.HealthService,
        animal_hold_service_1.AnimalHoldService,
        logger_service_1.LoggerService,
        farm_clock_service_1.FarmClockService])
], MilkService);
//# sourceMappingURL=milk.service.js.map