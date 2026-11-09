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
var ReproProtocolService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReproProtocolService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const task_service_1 = require("src/modules/task/application/services/task.service");
const semen_service_1 = require("src/modules/inventory/application/services/semen.service");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const protocol_metrics_1 = require("../../domain/protocol-metrics");
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = [
    client_1.ReproProtocolStatus.DRAFT,
    client_1.ReproProtocolStatus.SCHEDULED,
    client_1.ReproProtocolStatus.IN_PROGRESS,
];
let ReproProtocolService = ReproProtocolService_1 = class ReproProtocolService {
    prisma;
    taskService;
    semenService;
    log;
    constructor(prisma, taskService, semenService, logger) {
        this.prisma = prisma;
        this.taskService = taskService;
        this.semenService = semenService;
        this.log = logger.setContext(ReproProtocolService_1.name);
    }
    async listProtocols(farmId, query) {
        const [rows, instances] = await Promise.all([
            this.prisma.reproProtocol.findMany({
                where: {
                    deletedAt: null,
                    OR: [{ farmId }, { farmId: null, isSystemDefault: true }],
                },
                include: { _count: { select: { steps: true } } },
                orderBy: [{ isSystemDefault: 'desc' }, { name: 'asc' }, { id: 'asc' }],
                ...(0, pagination_1.getCursorArgs)(query),
            }),
            this.prisma.reproProtocolInstance.findMany({
                where: { farmId },
                select: {
                    protocolId: true,
                    status: true,
                    aiCompletedAt: true,
                    pregnancyOutcome: true,
                },
            }),
        ]);
        const page = (0, pagination_1.toCursorPage)(rows, query);
        const byProtocol = new Map();
        for (const i of instances) {
            const arr = byProtocol.get(i.protocolId) ?? [];
            arr.push(i);
            byProtocol.set(i.protocolId, arr);
        }
        return {
            items: page.items.map((p) => ({
                id: p.id,
                name: p.name,
                code: p.code,
                description: p.description,
                duration_days: p.durationDays,
                step_count: p._count.steps,
                is_system_default: p.isSystemDefault,
                editable: !p.isSystemDefault,
                metrics: (0, protocol_metrics_1.summarizeProtocol)(byProtocol.get(p.id) ?? []),
            })),
            meta: page.meta,
        };
    }
    async getProtocol(farmId, id) {
        const protocol = await this.prisma.reproProtocol.findFirst({
            where: {
                id,
                deletedAt: null,
                OR: [{ farmId }, { farmId: null, isSystemDefault: true }],
            },
            include: { steps: { orderBy: { dayNumber: 'asc' } } },
        });
        if (!protocol)
            throw new common_1.NotFoundException('Protocol not found');
        return {
            id: protocol.id,
            name: protocol.name,
            code: protocol.code,
            description: protocol.description,
            duration_days: protocol.durationDays,
            is_system_default: protocol.isSystemDefault,
            steps: protocol.steps.map((s) => ({
                day_number: s.dayNumber,
                title: s.title,
                step_type: s.stepType,
                instruction: s.instruction,
                is_required: s.isRequired,
            })),
        };
    }
    async getOwnedProtocolOrThrow(farmId, id) {
        const protocol = await this.prisma.reproProtocol.findFirst({
            where: { id, farmId, deletedAt: null, isSystemDefault: false },
        });
        if (!protocol)
            throw new common_1.NotFoundException('Protocol not found');
        return protocol;
    }
    async createProtocol(farmId, userId, dto) {
        const durationDays = Math.max(...dto.steps.map((s) => s.dayNumber));
        const protocol = await this.prisma.reproProtocol.create({
            data: {
                farmId,
                name: dto.name,
                description: dto.description,
                durationDays,
                isSystemDefault: false,
                createdBy: userId,
                steps: { create: dto.steps.map((s) => this.stepCreateInput(s)) },
            },
            include: { steps: { orderBy: { dayNumber: 'asc' } } },
        });
        this.log.info('Protocol created', { farmId, protocolId: protocol.id });
        return this.presentProtocol(protocol);
    }
    async updateProtocol(farmId, id, dto) {
        await this.getOwnedProtocolOrThrow(farmId, id);
        const durationDays = dto.steps
            ? Math.max(...dto.steps.map((s) => s.dayNumber))
            : undefined;
        const updated = await this.prisma.$transaction(async (tx) => {
            if (dto.steps) {
                await tx.reproProtocolStep.deleteMany({ where: { protocolId: id } });
            }
            return tx.reproProtocol.update({
                where: { id },
                data: {
                    name: dto.name,
                    description: dto.description,
                    durationDays,
                    ...(dto.steps
                        ? {
                            steps: {
                                create: dto.steps.map((s) => this.stepCreateInput(s)),
                            },
                        }
                        : {}),
                },
                include: { steps: { orderBy: { dayNumber: 'asc' } } },
            });
        });
        this.log.info('Protocol updated', { farmId, protocolId: id });
        return this.presentProtocol(updated);
    }
    async deleteProtocol(farmId, id) {
        await this.getOwnedProtocolOrThrow(farmId, id);
        const activeCount = await this.prisma.reproProtocolInstance.count({
            where: { protocolId: id, status: { in: ACTIVE_STATUSES } },
        });
        if (activeCount > 0) {
            throw new common_1.ConflictException(`Cannot delete: ${activeCount} cow(s) are currently on this protocol`);
        }
        await this.prisma.reproProtocol.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        this.log.info('Protocol deleted', { farmId, protocolId: id });
        return { deleted: true };
    }
    stepCreateInput(step) {
        return {
            dayNumber: step.dayNumber,
            title: step.title,
            stepType: step.stepType,
            instruction: step.instruction,
            isRequired: step.isRequired ?? true,
        };
    }
    presentProtocol(protocol) {
        return {
            id: protocol.id,
            name: protocol.name,
            code: protocol.code,
            description: protocol.description,
            duration_days: protocol.durationDays,
            is_system_default: protocol.isSystemDefault,
            steps: protocol.steps
                .sort((a, b) => a.dayNumber - b.dayNumber)
                .map((s) => ({
                day_number: s.dayNumber,
                title: s.title,
                step_type: s.stepType,
                instruction: s.instruction,
                is_required: s.isRequired,
            })),
        };
    }
    async apply(farmId, userId, dto) {
        const protocol = await this.prisma.reproProtocol.findFirst({
            where: {
                id: dto.protocolId,
                deletedAt: null,
                OR: [{ farmId }, { farmId: null, isSystemDefault: true }],
            },
            include: { steps: { orderBy: { dayNumber: 'asc' } } },
        });
        if (!protocol)
            throw new common_1.NotFoundException('Protocol not found');
        if (protocol.steps.length === 0) {
            throw new common_1.BadRequestException('Protocol has no steps to schedule');
        }
        const cattleIds = [...new Set(dto.cattleIds)];
        const validCount = await this.prisma.cattle.count({
            where: {
                id: { in: cattleIds },
                ...(0, herd_scope_1.activeHerd)(farmId),
            },
        });
        if (validCount !== cattleIds.length) {
            throw new common_1.BadRequestException('One or more cattle do not belong to this farm');
        }
        const start = this.parseStartDate(dto.startDate);
        const status = start.getTime() > Date.now()
            ? client_1.ReproProtocolStatus.SCHEDULED
            : client_1.ReproProtocolStatus.IN_PROGRESS;
        const firstStepDay = protocol.steps[0].dayNumber;
        const instanceIds = [];
        for (const cattleId of cattleIds) {
            const instance = await this.prisma.reproProtocolInstance.create({
                data: {
                    farmId,
                    protocolId: protocol.id,
                    cattleId,
                    startDate: start,
                    status,
                    currentStepDay: firstStepDay,
                    createdBy: userId,
                },
            });
            for (const step of protocol.steps) {
                const override = dto.stepOverrides?.find((o) => (o.stepId && o.stepId === step.id) ||
                    o.dayNumber === step.dayNumber);
                let dueAt = override?.dueAt
                    ? new Date(override.dueAt)
                    : this.addDays(start, step.dayNumber);
                if (isNaN(dueAt.getTime())) {
                    dueAt = this.addDays(start, step.dayNumber);
                }
                await this.taskService.createInternal({
                    farmId,
                    createdBy: userId,
                    name: `${protocol.name} — ${step.title}`,
                    details: step.instruction ?? undefined,
                    category: client_1.TaskCategory.BREEDING,
                    dueAt,
                    source: client_1.TaskSource.SYSTEM_AUTO,
                    relatedCattleId: cattleId,
                    sourceEventType: 'REPRO_PROTOCOL_INSTANCE',
                    sourceEventId: instance.id,
                });
            }
            instanceIds.push(instance.id);
        }
        this.log.info('Reproductive protocol applied', {
            farmId,
            protocolId: protocol.id,
            cows: cattleIds.length,
        });
        return {
            protocol_id: protocol.id,
            applied: cattleIds.length,
            tasks_created: cattleIds.length * protocol.steps.length,
            instance_ids: instanceIds,
        };
    }
    async listInstances(farmId, query) {
        const rows = await this.prisma.reproProtocolInstance.findMany({
            where: {
                farmId,
                ...(query.protocolId ? { protocolId: query.protocolId } : {}),
                ...(query.cattleId ? { cattleId: query.cattleId } : {}),
                ...(query.status
                    ? { status: query.status }
                    : {}),
            },
            include: { protocol: { select: { name: true, code: true } } },
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        return {
            items: page.items.map((r) => this.mapInstance(r)),
            meta: page.meta,
        };
    }
    async getInstance(farmId, id) {
        return this.mapInstance(await this.getInstanceOrThrow(farmId, id));
    }
    async recordAi(farmId, userId, id, dto) {
        const instance = await this.getInstanceOrThrow(farmId, id);
        if (!ACTIVE_STATUSES.includes(instance.status)) {
            throw new common_1.BadRequestException(`Cannot record AI — protocol is ${instance.status}`);
        }
        if (dto.semenBatchId) {
            await this.semenService.decrementStraw(farmId, dto.semenBatchId, 1, userId);
        }
        const aiAt = dto.aiDate ? new Date(dto.aiDate) : new Date();
        const updated = await this.prisma.reproProtocolInstance.update({
            where: { id },
            data: {
                aiCompletedAt: aiAt,
                completedAt: aiAt,
                status: client_1.ReproProtocolStatus.COMPLETED,
                pregnancyOutcome: client_1.ReproPregnancyOutcome.WAITING_PD,
                ...(dto.notes ? { notes: dto.notes } : {}),
            },
            include: { protocol: { select: { name: true, code: true } } },
        });
        this.log.info('Protocol AI recorded', { farmId, instanceId: id });
        return this.mapInstance(updated);
    }
    async recordOutcome(farmId, userId, id, dto) {
        const instance = await this.getInstanceOrThrow(farmId, id);
        if (!instance.aiCompletedAt) {
            throw new common_1.BadRequestException('Record the AI step before the pregnancy outcome');
        }
        const updated = await this.prisma.reproProtocolInstance.update({
            where: { id },
            data: {
                pregnancyOutcome: dto.outcome,
                outcomeRecordedAt: new Date(),
                ...(dto.notes ? { notes: dto.notes } : {}),
            },
            include: { protocol: { select: { name: true, code: true } } },
        });
        this.log.info('Protocol pregnancy outcome recorded', {
            farmId,
            instanceId: id,
            outcome: dto.outcome,
        });
        return this.mapInstance(updated);
    }
    async closeInstance(farmId, userId, id, dto) {
        const instance = await this.getInstanceOrThrow(farmId, id);
        if (instance.status === client_1.ReproProtocolStatus.COMPLETED) {
            throw new common_1.BadRequestException('A completed protocol cannot be closed');
        }
        const updated = await this.prisma.reproProtocolInstance.update({
            where: { id },
            data: {
                status: dto.status,
                endReason: dto.reason,
                completedAt: new Date(),
            },
            include: { protocol: { select: { name: true, code: true } } },
        });
        return this.mapInstance(updated);
    }
    async kpis(farmId) {
        const instances = await this.prisma.reproProtocolInstance.findMany({
            where: { farmId },
            select: {
                status: true,
                aiCompletedAt: true,
                pregnancyOutcome: true,
            },
        });
        const m = (0, protocol_metrics_1.summarizeProtocol)(instances);
        return {
            total_applied: m.applied,
            in_progress: m.in_progress,
            completed: m.completed,
            ai_completed: m.ai_completed,
            pregnant: m.pregnant,
            open: m.open,
            pregnancy_loss: m.pregnancy_loss,
            conception_rate: m.conception_rate,
            pregnancy_loss_rate: m.pregnant + m.pregnancy_loss > 0
                ? Math.round((m.pregnancy_loss / (m.pregnant + m.pregnancy_loss)) * 1000) / 10
                : null,
        };
    }
    async getInstanceOrThrow(farmId, id) {
        const instance = await this.prisma.reproProtocolInstance.findFirst({
            where: { id, farmId },
            include: { protocol: { select: { name: true, code: true } } },
        });
        if (!instance)
            throw new common_1.NotFoundException('Protocol instance not found');
        return instance;
    }
    mapInstance(row) {
        return {
            id: row.id,
            protocol_id: row.protocolId,
            protocol_name: row.protocol.name,
            cattle_id: row.cattleId,
            start_date: row.startDate,
            status: row.status,
            current_step_day: row.currentStepDay,
            ai_completed_at: row.aiCompletedAt,
            pregnancy_outcome: row.pregnancyOutcome,
            outcome_recorded_at: row.outcomeRecordedAt,
            completed_at: row.completedAt,
            end_reason: row.endReason,
            notes: row.notes,
            created_at: row.createdAt,
        };
    }
    parseStartDate(dateStr) {
        if (!dateStr)
            return new Date();
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(y, m - 1, d, 8, 0, 0);
        }
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date() : d;
    }
    addDays(date, n) {
        const result = new Date(date);
        result.setDate(result.getDate() + n);
        return result;
    }
};
exports.ReproProtocolService = ReproProtocolService;
exports.ReproProtocolService = ReproProtocolService = ReproProtocolService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        task_service_1.TaskService,
        semen_service_1.SemenService,
        logger_service_1.LoggerService])
], ReproProtocolService);
//# sourceMappingURL=repro-protocol.service.js.map