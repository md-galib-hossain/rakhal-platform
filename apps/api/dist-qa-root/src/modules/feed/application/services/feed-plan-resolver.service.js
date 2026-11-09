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
exports.FeedPlanResolverService = void 0;
exports.pickProgram = pickProgram;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
function pickProgram(individual, groupRows, herd) {
    const build = (row, via, conflict) => ({
        assignmentId: row.id,
        planId: row.plan.id,
        planName: row.plan.name,
        kind: row.plan.kind,
        via,
        ...(via === 'GROUP' && row.animalGroupId
            ? { groupId: row.animalGroupId }
            : {}),
        conflict,
        lines: row.plan.lines,
    });
    if (individual)
        return build(individual, 'INDIVIDUAL', false);
    if (groupRows.length > 0) {
        const sorted = [...groupRows].sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime() ||
            b.id.localeCompare(a.id));
        const distinctGroups = new Set(sorted.map((r) => r.animalGroupId));
        return build(sorted[0], 'GROUP', distinctGroups.size > 1);
    }
    if (herd)
        return build(herd, 'HERD', false);
    return null;
}
let FeedPlanResolverService = class FeedPlanResolverService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resolveForCattle(farmId, cattleIds) {
        const out = new Map();
        const ids = [...new Set(cattleIds)];
        if (ids.length === 0)
            return out;
        const [herd, assignments] = await Promise.all([
            this.prisma.cattle.findMany({
                where: { ...(0, herd_scope_1.activeHerd)(farmId), id: { in: ids } },
                select: { id: true },
            }),
            this.prisma.feedPlanAssignment.findMany({
                where: {
                    farmId,
                    removedAt: null,
                    plan: { isActive: true },
                    OR: [
                        { targetType: 'INDIVIDUAL', cattleId: { in: ids } },
                        { targetType: 'GROUP' },
                        { targetType: 'HERD' },
                    ],
                },
                include: {
                    plan: {
                        select: {
                            id: true,
                            name: true,
                            kind: true,
                            lines: { orderBy: { sortOrder: 'asc' } },
                        },
                    },
                },
            }),
        ]);
        const activeIds = herd.map((c) => c.id);
        if (activeIds.length === 0)
            return out;
        const individualByCow = new Map();
        const groupById = new Map();
        let herdRow;
        for (const a of assignments) {
            const row = { ...a, targetType: a.targetType };
            if (a.targetType === 'INDIVIDUAL' && a.cattleId)
                individualByCow.set(a.cattleId, row);
            else if (a.targetType === 'GROUP' && a.animalGroupId)
                groupById.set(a.animalGroupId, row);
            else if (a.targetType === 'HERD')
                herdRow = row;
        }
        const membersOf = new Map();
        if (groupById.size > 0) {
            const members = await this.prisma.animalGroupMember.findMany({
                where: {
                    farmId,
                    cattleId: { in: activeIds },
                    groupId: { in: [...groupById.keys()] },
                },
                select: { cattleId: true, groupId: true },
            });
            for (const m of members) {
                const list = membersOf.get(m.cattleId) ?? [];
                const row = groupById.get(m.groupId);
                if (row)
                    list.push(row);
                membersOf.set(m.cattleId, list);
            }
        }
        for (const id of activeIds) {
            const picked = pickProgram(individualByCow.get(id), membersOf.get(id) ?? [], herdRow);
            if (picked)
                out.set(id, picked);
        }
        return out;
    }
};
exports.FeedPlanResolverService = FeedPlanResolverService;
exports.FeedPlanResolverService = FeedPlanResolverService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FeedPlanResolverService);
//# sourceMappingURL=feed-plan-resolver.service.js.map