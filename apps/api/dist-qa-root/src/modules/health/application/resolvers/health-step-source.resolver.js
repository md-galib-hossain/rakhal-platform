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
exports.HealthStepSourceResolver = void 0;
exports.stepSourceKey = stepSourceKey;
exports.parseStepSourceKey = parseStepSourceKey;
exports.stepGroupLabel = stepGroupLabel;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const farm_time_1 = require("src/common/farm-time/farm-time");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const source_resolver_registry_1 = require("src/modules/notification/application/resolvers/source-resolver.registry");
const LIVE_TASK_STATUSES = [
    client_1.HealthTaskStatus.PENDING,
    client_1.HealthTaskStatus.RESCHEDULED,
    client_1.HealthTaskStatus.OVERDUE,
];
const OPEN_CASE_STATUSES = [
    client_1.HealthCaseStatus.ACTIVE,
    client_1.HealthCaseStatus.IMPROVING,
    client_1.HealthCaseStatus.WORSENING,
    client_1.HealthCaseStatus.STABLE,
];
const DAY_MS = 24 * 60 * 60 * 1000;
function stepSourceKey(ref) {
    return `${ref.kind}:${ref.id}:${ref.ymd}`;
}
function parseStepSourceKey(key) {
    const m = /^(round|case):([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(key);
    return m ? { kind: m[1], id: m[2], ymd: m[3] } : null;
}
const STEP_SELECT = {
    id: true,
    cattleId: true,
    title: true,
    dueDateTime: true,
    timeOfDay: true,
    healthCaseId: true,
    cattle: {
        select: { name: true, tagNumber: true, herdStatus: true, deletedAt: true },
    },
    healthCase: { select: { healthPlan: { select: { name: true } } } },
    planEnrollment: {
        select: {
            planApplicationId: true,
            healthPlan: { select: { name: true } },
        },
    },
    healthPlan: { select: { name: true } },
};
let HealthStepSourceResolver = class HealthStepSourceResolver {
    prisma;
    registry;
    sourceType = 'HEALTH_STEP';
    constructor(prisma, registry) {
        this.prisma = prisma;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
    }
    async loadGroup(farmId, ref, timezone) {
        const start = (0, farm_time_1.zonedToUtc)(timezone, ref.ymd, '00:00');
        const nextYmd = new Date((0, farm_time_1.dayKey)(ref.ymd).getTime() + DAY_MS)
            .toISOString()
            .slice(0, 10);
        const end = (0, farm_time_1.zonedToUtc)(timezone, nextYmd, '00:00');
        const scope = ref.kind === 'round'
            ? {
                planEnrollment: {
                    is: {
                        planApplicationId: ref.id,
                        status: client_1.PlanEnrollmentStatus.ACTIVE,
                        deletedAt: null,
                    },
                },
            }
            : {
                healthCaseId: ref.id,
                healthCase: {
                    is: { status: { in: OPEN_CASE_STATUSES }, deletedAt: null },
                },
            };
        const open = await this.prisma.healthTask.findMany({
            where: {
                farmId,
                deletedAt: null,
                status: { in: LIVE_TASK_STATUSES },
                dueDateTime: { gte: start, lt: end },
                ...scope,
            },
            select: STEP_SELECT,
            orderBy: [{ dueDateTime: 'asc' }, { id: 'asc' }],
        });
        const live = open.filter((s) => s.cattle.herdStatus === client_1.HerdStatus.ACTIVE && !s.cattle.deletedAt);
        return { ref, open, live };
    }
    async resolve(ctx) {
        const ref = parseStepSourceKey(ctx.sourceKey);
        if (!ref)
            return { state: 'GONE' };
        const group = await this.loadGroup(ctx.farmId, ref, ctx.timezone);
        if (group.open.length === 0)
            return { state: 'GONE' };
        if (group.live.length === 0)
            return { state: 'ANIMALS_GONE' };
        const label = stepGroupLabel(group);
        const animals = new Set(group.live.map((s) => s.cattleId)).size;
        const leadDays = Math.round(ctx.leadMinutes / 1440);
        return {
            state: 'OK',
            userIds: [],
            roles: ['Owner', 'Manager'],
            params: { label, animals, date: ref.ymd, days: leadDays },
            title: titleForLead(ctx.leadMinutes, leadDays),
            message: `${label}: ${animals} animal(s), due ${ref.ymd}.`,
            link: `/healthcare?healthTab=protocols&date=${ref.ymd}`,
            data: {
                healthTab: 'protocols',
                date: ref.ymd,
                ...(ref.kind === 'round'
                    ? { planApplicationId: ref.id }
                    : { healthCaseId: ref.id }),
            },
        };
    }
};
exports.HealthStepSourceResolver = HealthStepSourceResolver;
exports.HealthStepSourceResolver = HealthStepSourceResolver = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        source_resolver_registry_1.SourceResolverRegistry])
], HealthStepSourceResolver);
function stepGroupLabel(group) {
    const first = group.live[0] ?? group.open[0];
    const planName = first.planEnrollment?.healthPlan.name ??
        first.healthCase?.healthPlan?.name ??
        first.healthPlan?.name ??
        first.title;
    return group.ref.kind === 'case'
        ? `${planName} · ${first.cattle.name ?? first.cattle.tagNumber}`
        : planName;
}
function titleForLead(leadMinutes, leadDays) {
    if (leadMinutes === 0)
        return 'Health Step Due Today';
    if (leadMinutes < 1440)
        return `Health Step Due in ${leadMinutes} Minutes`;
    if (leadDays === 1)
        return 'Health Step Due Tomorrow';
    return `Health Step Due in ${leadDays} Days`;
}
//# sourceMappingURL=health-step-source.resolver.js.map