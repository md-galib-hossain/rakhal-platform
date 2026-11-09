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
exports.HealthOutcomesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const health_case_outcome_1 = require("../../domain/health-case-outcome");
const morbidity_trend_1 = require("../../domain/morbidity-trend");
const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED_STATUSES = [
    client_1.HealthCaseStatus.RECOVERED,
    client_1.HealthCaseStatus.MORTALITY,
    client_1.HealthCaseStatus.CLOSED,
];
let HealthOutcomesService = class HealthOutcomesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async caseSummary(farmId, healthCase, now = new Date()) {
        const closed = healthCase.closedDate;
        const expenseIds = healthCase.treatmentLogs
            .map((log) => log.financeTransactionId)
            .filter((id) => Boolean(id));
        const [amountById, previous] = await Promise.all([
            this.expenseAmounts(farmId, expenseIds),
            this.previousSameCondition(farmId, healthCase),
        ]);
        const totalCost = expenseIds.reduce((sum, id) => sum + (amountById.get(id) ?? 0), 0);
        return {
            daysSick: closed
                ? (0, health_case_outcome_1.elapsedDays)(healthCase.startDate, closed)
                : (0, health_case_outcome_1.dayOfIllness)(healthCase.startDate, now),
            daysToRecover: healthCase.status === client_1.HealthCaseStatus.RECOVERED && closed
                ? (0, health_case_outcome_1.elapsedDays)(healthCase.startDate, closed)
                : null,
            outcome: CLOSED_STATUSES.includes(healthCase.status)
                ? healthCase.status
                : null,
            treatmentCount: healthCase.treatmentLogs.length,
            stepsDone: healthCase.currentStep,
            stepsTotal: healthCase.totalSteps,
            protocol: healthCase.healthPlan,
            totalCost: Math.round(totalCost * 100) / 100,
            recurrence: previous
                ? {
                    isRecurrence: true,
                    previousCaseId: previous.id,
                    previousClosedDate: previous.closedDate,
                    daysSincePrevious: Math.max(0, Math.floor((healthCase.startDate.getTime() -
                        previous.closedDate.getTime()) /
                        DAY_MS)),
                }
                : {
                    isRecurrence: false,
                    previousCaseId: null,
                    previousClosedDate: null,
                    daysSincePrevious: null,
                },
        };
    }
    async getOutcomes(farmId, days, now = new Date()) {
        const since = new Date(now.getTime() - days * DAY_MS);
        const historyFrom = new Date(since.getTime() - health_case_outcome_1.RECURRENCE_WINDOW_DAYS * DAY_MS);
        const rows = await this.prisma.healthCase.findMany({
            where: {
                farmId,
                deletedAt: null,
                careType: client_1.HealthCareType.CURATIVE,
                OR: [
                    { startDate: { gte: since } },
                    { closedDate: { gte: historyFrom } },
                ],
            },
            select: {
                id: true,
                cattleId: true,
                condition: true,
                status: true,
                startDate: true,
                closedDate: true,
            },
        });
        const cohort = rows.filter((row) => row.startDate >= since);
        const history = rows.filter((row) => row.closedDate);
        const logs = cohort.length
            ? await this.prisma.treatmentLog.findMany({
                where: {
                    farmId,
                    healthCaseId: { in: cohort.map((row) => row.id) },
                    financeTransactionId: { not: null },
                    voidedAt: null,
                },
                select: { healthCaseId: true, financeTransactionId: true },
            })
            : [];
        const amountById = await this.expenseAmounts(farmId, logs.map((log) => log.financeTransactionId));
        const costByCase = new Map();
        for (const log of logs) {
            costByCase.set(log.healthCaseId, (costByCase.get(log.healthCaseId) ?? 0) +
                (amountById.get(log.financeTransactionId) ?? 0));
        }
        const cases = cohort.map((row) => ({
            condition: row.condition,
            status: row.status,
            startDate: row.startDate,
            closedDate: row.closedDate,
            cost: costByCase.get(row.id) ?? 0,
            isRecurrence: (0, health_case_outcome_1.findPreviousSameCondition)(row, history) !== null,
        }));
        return { windowDays: days, since, ...(0, health_case_outcome_1.aggregateOutcomes)(cases) };
    }
    async getMorbidityTrend(farmId, days, now = new Date()) {
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const where = {
            farmId,
            deletedAt: null,
            careType: client_1.HealthCareType.CURATIVE,
        };
        if (days === undefined) {
            const rows = await this.prisma.healthCase.findMany({
                where,
                orderBy: { startDate: 'asc' },
                select: { startDate: true },
            });
            if (rows.length === 0) {
                return {
                    windowDays: null,
                    bucket: 'month',
                    total: 0,
                    previousTotal: null,
                    points: [],
                };
            }
            return {
                windowDays: null,
                ...(0, morbidity_trend_1.buildTrend)(rows.map((row) => row.startDate), rows[0].startDate, today),
                total: rows.length,
                previousTotal: null,
            };
        }
        const from = new Date(today.getTime() - (days - 1) * DAY_MS);
        const previousFrom = new Date(from.getTime() - days * DAY_MS);
        const [rows, previousTotal] = await Promise.all([
            this.prisma.healthCase.findMany({
                where: { ...where, startDate: { gte: from } },
                select: { startDate: true },
            }),
            this.prisma.healthCase.count({
                where: { ...where, startDate: { gte: previousFrom, lt: from } },
            }),
        ]);
        return {
            windowDays: days,
            ...(0, morbidity_trend_1.buildTrend)(rows.map((row) => row.startDate), from, today),
            total: rows.length,
            previousTotal,
        };
    }
    async previousSameCondition(farmId, healthCase) {
        if (!healthCase.condition)
            return null;
        const earliest = new Date(healthCase.startDate.getTime() - health_case_outcome_1.RECURRENCE_WINDOW_DAYS * DAY_MS);
        const candidates = await this.prisma.healthCase.findMany({
            where: {
                farmId,
                cattleId: healthCase.cattleId,
                id: { not: healthCase.id },
                deletedAt: null,
                condition: healthCase.condition,
                closedDate: { gte: earliest, lte: healthCase.startDate },
            },
            select: {
                id: true,
                cattleId: true,
                condition: true,
                startDate: true,
                closedDate: true,
            },
        });
        const found = (0, health_case_outcome_1.findPreviousSameCondition)(healthCase, candidates);
        return found
            ? { id: found.id, closedDate: found.closedDate }
            : null;
    }
    async expenseAmounts(farmId, ids) {
        if (ids.length === 0)
            return new Map();
        const expenses = await this.prisma.expense.findMany({
            where: { farmId, id: { in: [...new Set(ids)] }, voidedAt: null },
            select: { id: true, amount: true },
        });
        return new Map(expenses.map((e) => [e.id, Number(e.amount)]));
    }
};
exports.HealthOutcomesService = HealthOutcomesService;
exports.HealthOutcomesService = HealthOutcomesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HealthOutcomesService);
//# sourceMappingURL=health-outcomes.service.js.map