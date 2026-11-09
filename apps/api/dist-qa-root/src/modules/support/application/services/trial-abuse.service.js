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
var TrialAbuseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrialAbuseService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const audit_service_1 = require("src/modules/audit/application/services/audit.service");
const subscription_lifecycle_service_1 = require("src/modules/subscription/application/services/subscription-lifecycle.service");
let TrialAbuseService = TrialAbuseService_1 = class TrialAbuseService {
    prisma;
    lifecycle;
    audit;
    log;
    constructor(prisma, lifecycle, audit, logger) {
        this.prisma = prisma;
        this.lifecycle = lifecycle;
        this.audit = audit;
        this.log = logger.setContext(TrialAbuseService_1.name);
    }
    async grantTrialIfEligible(farmId, ownerUserId) {
        try {
            await this.prisma.trialGrant.create({
                data: { userId: ownerUserId, farmId },
            });
        }
        catch (err) {
            if (err.code === 'P2002') {
                this.log.warn('Duplicate trial blocked (owner already used their trial)', {
                    ownerUserId,
                    farmId,
                });
                await this.audit
                    .record({
                    actorUserId: ownerUserId,
                    action: client_1.AuditAction.SUSPICIOUS_ACTIVITY,
                    entityType: 'Farm',
                    entityId: farmId,
                    farmId,
                    metadata: { reason: 'DUPLICATE_TRIAL_BLOCKED' },
                })
                    .catch(() => undefined);
                return { granted: false };
            }
            throw err;
        }
        await this.lifecycle.provisionTrial(farmId);
        return { granted: true };
    }
};
exports.TrialAbuseService = TrialAbuseService;
exports.TrialAbuseService = TrialAbuseService = TrialAbuseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        subscription_lifecycle_service_1.SubscriptionLifecycleService,
        audit_service_1.AuditService,
        logger_service_1.LoggerService])
], TrialAbuseService);
//# sourceMappingURL=trial-abuse.service.js.map