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
var PlanCatalogueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanCatalogueService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
let PlanCatalogueService = PlanCatalogueService_1 = class PlanCatalogueService {
    prisma;
    logger;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.logger = logger;
        this.log = this.logger.setContext(PlanCatalogueService_1.name);
    }
    async listPlans() {
        const plans = await this.prisma.subscriptionPlan.findMany({
            orderBy: [{ monthlyPrice: 'asc' }, { id: 'asc' }],
            include: {
                features: {
                    where: { enabled: true },
                    include: { feature: { select: { key: true } } },
                },
            },
        });
        this.log.debug('Listed subscription plans', { count: plans.length });
        return plans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            description: plan.description,
            monthly_price: plan.monthlyPrice.toNumber(),
            yearly_price: plan.yearlyPrice === null ? null : plan.yearlyPrice.toNumber(),
            limits: {
                max_cattle: plan.maxCattle,
                max_farm_members: plan.maxFarmMembers,
            },
            features: plan.features.map((planFeature) => planFeature.feature.key),
        }));
    }
};
exports.PlanCatalogueService = PlanCatalogueService;
exports.PlanCatalogueService = PlanCatalogueService = PlanCatalogueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], PlanCatalogueService);
//# sourceMappingURL=plan-catalogue.service.js.map