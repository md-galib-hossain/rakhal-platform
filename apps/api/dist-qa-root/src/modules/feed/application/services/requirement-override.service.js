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
var RequirementOverrideService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirementOverrideService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const manual_requirement_1 = require("../../domain/manual-requirement");
const feed_requirements_service_1 = require("./feed-requirements.service");
let RequirementOverrideService = RequirementOverrideService_1 = class RequirementOverrideService {
    prisma;
    requirements;
    activityLog;
    log;
    constructor(prisma, logger, requirements, activityLog) {
        this.prisma = prisma;
        this.requirements = requirements;
        this.activityLog = activityLog;
        this.log = logger.setContext(RequirementOverrideService_1.name);
    }
    async get(farmId, cattleId) {
        const resolved = await this.requireResolved(farmId, cattleId);
        const [active, last] = await Promise.all([
            this.prisma.cattleRequirementOverride.findFirst({
                where: { farmId, cattleId, effectiveTo: null },
            }),
            this.prisma.cattleRequirementOverride.findFirst({
                where: { farmId, cattleId, effectiveTo: { not: null } },
                orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
            }),
        ]);
        const names = await this.userNames([active, last]);
        const calculated = resolved.shaped.dynamic_requirements ?? resolved.shaped.requirements;
        return {
            active: active ? this.rowShape(active, names) : null,
            resolved: resolved.shaped,
            calculated,
            last: last ? this.rowShape(last, names) : null,
        };
    }
    async history(farmId, cattleId, query) {
        await this.requireCow(farmId, cattleId);
        const rows = await this.prisma.cattleRequirementOverride.findMany({
            where: { farmId, cattleId },
            orderBy: [{ effectiveFrom: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        const names = await this.userNames(page.items);
        return { ...page, items: page.items.map((r) => this.rowShape(r, names)) };
    }
    async set(farmId, userId, cattleId, dto) {
        const cow = await this.prisma.cattle.findFirst({
            where: { id: cattleId, ...(0, herd_scope_1.activeHerd)(farmId) },
            select: { id: true, tagNumber: true, lastWeightKg: true },
        });
        if (!cow)
            throw new common_1.NotFoundException('Cattle not found');
        const { errors, warnings } = (0, manual_requirement_1.validateManualValues)(dto, cow.lastWeightKg);
        if (errors.length > 0) {
            throw new common_1.BadRequestException({
                message: errors.map((e) => e.message).join(' '),
                errors,
            });
        }
        const before = await this.requireResolved(farmId, cattleId);
        const write = () => this.prisma.$transaction(async (tx) => {
            const now = new Date();
            await tx.cattleRequirementOverride.updateMany({
                where: { farmId, cattleId, effectiveTo: null },
                data: { effectiveTo: now, endReason: 'REPLACED', endedBy: userId },
            });
            return tx.cattleRequirementOverride.create({
                data: {
                    farmId,
                    cattleId,
                    dmKg: dto.dmKg,
                    cpKg: dto.cpKg,
                    meMj: dto.meMj,
                    ndfKg: dto.ndfKg ?? null,
                    ndfMaxKg: dto.ndfMaxKg ?? null,
                    adfKg: dto.adfKg ?? null,
                    fatKg: dto.fatKg ?? null,
                    tdnKg: dto.tdnKg ?? null,
                    calciumKg: dto.calciumKg ?? null,
                    phosphorusKg: dto.phosphorusKg ?? null,
                    rdpPct: dto.rdpPct ?? null,
                    rupPct: dto.rupPct ?? null,
                    note: dto.note ?? null,
                    dynamicSnapshot: before.snapshot,
                    effectiveFrom: now,
                    setBy: userId,
                },
            });
        });
        let created;
        try {
            created = await write();
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                created = await write();
            }
            else {
                throw err;
            }
        }
        await this.audit(farmId, userId, cattleId, 'Manual nutrition requirement set', `Manual requirement set for ${cow.tagNumber}: DM ${dto.dmKg} kg, CP ${dto.cpKg} kg, ME ${dto.meMj} MJ per day.`);
        const resolved = await this.requireResolved(farmId, cattleId);
        const names = await this.userNames([created]);
        return {
            active: this.rowShape(created, names),
            resolved: resolved.shaped,
            warnings: warnings,
        };
    }
    async turnOff(farmId, userId, cattleId) {
        const cow = await this.requireCow(farmId, cattleId);
        const closed = await this.prisma.cattleRequirementOverride.updateMany({
            where: { farmId, cattleId, effectiveTo: null },
            data: {
                effectiveTo: new Date(),
                endReason: 'TURNED_OFF',
                endedBy: userId,
            },
        });
        if (closed.count === 0) {
            throw new common_1.NotFoundException('Manual requirement is not on for this animal');
        }
        await this.audit(farmId, userId, cattleId, 'Manual nutrition requirement turned off', `Manual requirement turned off for ${cow.tagNumber}; her calculated requirement applies again.`);
        const resolved = await this.requireResolved(farmId, cattleId);
        return { active: null, resolved: resolved.shaped };
    }
    async requireCow(farmId, cattleId) {
        const cow = await this.prisma.cattle.findFirst({
            where: { id: cattleId, ...(0, herd_scope_1.activeHerd)(farmId) },
            select: { id: true, tagNumber: true },
        });
        if (!cow)
            throw new common_1.NotFoundException('Cattle not found');
        return cow;
    }
    async requireResolved(farmId, cattleId) {
        const resolved = await this.requirements.resolveOne(farmId, cattleId);
        if (!resolved)
            throw new common_1.NotFoundException('Cattle not found');
        return resolved;
    }
    async userNames(rows) {
        const ids = new Set();
        for (const r of rows) {
            if (!r)
                continue;
            ids.add(r.setBy);
            if (r.endedBy)
                ids.add(r.endedBy);
        }
        if (ids.size === 0)
            return new Map();
        const users = await this.prisma.user.findMany({
            where: { id: { in: [...ids] } },
            select: { id: true, name: true },
        });
        return new Map(users.map((u) => [u.id, u.name]));
    }
    rowShape(r, names) {
        return {
            id: r.id,
            cattle_id: r.cattleId,
            dm_kg: r.dmKg,
            cp_kg: r.cpKg,
            me_mj: r.meMj,
            ndf_kg: r.ndfKg,
            ndf_max_kg: r.ndfMaxKg,
            adf_kg: r.adfKg,
            fat_kg: r.fatKg,
            tdn_kg: r.tdnKg,
            calcium_kg: r.calciumKg,
            phosphorus_kg: r.phosphorusKg,
            rdp_pct: r.rdpPct,
            rup_pct: r.rupPct,
            note: r.note,
            dynamic_snapshot: r.dynamicSnapshot,
            effective_from: r.effectiveFrom,
            effective_to: r.effectiveTo,
            end_reason: r.endReason,
            set_by: r.setBy,
            set_by_name: names.get(r.setBy) ?? null,
            ended_by: r.endedBy,
            ended_by_name: r.endedBy ? (names.get(r.endedBy) ?? null) : null,
        };
    }
    async audit(farmId, actorId, cattleId, eventTitle, actionDetails) {
        try {
            await this.activityLog.record({
                farmId,
                module: client_1.ActivityLogModule.COW_MANAGEMENT,
                eventTitle,
                actionDetails,
                actorId,
                relatedCattleId: cattleId,
            });
        }
        catch (err) {
            this.log.error('Manual requirement activity log failed', {
                farmId,
                cattleId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
};
exports.RequirementOverrideService = RequirementOverrideService;
exports.RequirementOverrideService = RequirementOverrideService = RequirementOverrideService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        feed_requirements_service_1.FeedRequirementsService,
        activity_log_service_1.ActivityLogService])
], RequirementOverrideService);
//# sourceMappingURL=requirement-override.service.js.map