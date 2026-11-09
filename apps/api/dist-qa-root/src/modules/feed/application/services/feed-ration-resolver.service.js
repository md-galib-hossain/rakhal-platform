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
exports.FeedRationResolverService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const feed_plan_resolver_service_1 = require("./feed-plan-resolver.service");
let FeedRationResolverService = class FeedRationResolverService {
    prisma;
    plans;
    constructor(prisma, plans) {
        this.prisma = prisma;
        this.plans = plans;
    }
    async resolveActiveRation(farmId, cattleId) {
        const cattle = await this.prisma.cattle.findFirst({
            where: { id: cattleId, ...(0, herd_scope_1.activeHerd)(farmId) },
            select: { id: true },
        });
        if (!cattle)
            throw new common_1.NotFoundException('Cattle not found');
        const program = (await this.plans.resolveForCattle(farmId, [cattleId])).get(cattleId);
        if (!program)
            return null;
        const only = program.lines.length === 1 && program.lines[0].lineType === 'PREPARED'
            ? program.lines[0]
            : null;
        if (!only?.concentrationId)
            return null;
        const concentration = await this.prisma.feedConcentration.findFirst({
            where: {
                id: only.concentrationId,
                farmId,
                deletedAt: null,
                kind: 'FEED_MIXTURE',
            },
        });
        return concentration ? { concentration, matchLevel: program.via } : null;
    }
};
exports.FeedRationResolverService = FeedRationResolverService;
exports.FeedRationResolverService = FeedRationResolverService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        feed_plan_resolver_service_1.FeedPlanResolverService])
], FeedRationResolverService);
//# sourceMappingURL=feed-ration-resolver.service.js.map