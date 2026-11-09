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
var SubscriptionLifecycleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionLifecycleService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const transactional_email_service_1 = require("src/modules/email/application/services/transactional-email.service");
const email_template_enum_1 = require("src/modules/email/domain/enums/email-template.enum");
const subscription_features_1 = require("../../domain/subscription-features");
const subscription_access_service_1 = require("./subscription-access.service");
const DAY_MS = 24 * 60 * 60 * 1000;
function addBillingPeriod(from, period) {
    const d = new Date(from);
    if (period === client_1.BillingPeriod.YEARLY) {
        d.setFullYear(d.getFullYear() + 1);
    }
    else {
        d.setMonth(d.getMonth() + 1);
    }
    return d;
}
let SubscriptionLifecycleService = SubscriptionLifecycleService_1 = class SubscriptionLifecycleService {
    prisma;
    access;
    txEmail;
    log;
    constructor(prisma, access, txEmail, logger) {
        this.prisma = prisma;
        this.access = access;
        this.txEmail = txEmail;
        this.log = logger.setContext(SubscriptionLifecycleService_1.name);
    }
    async provision(farmId, opts) {
        const existing = await this.prisma.farmSubscription.findFirst({
            where: { farmId },
        });
        if (existing) {
            return existing;
        }
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { name: opts.planName },
            select: { id: true },
        });
        if (!plan) {
            this.log.warn('Plan not found — skipping subscription provisioning', {
                farmId,
                planName: opts.planName,
            });
            return null;
        }
        const now = new Date();
        const expiresAt = opts.durationDays === null
            ? null
            : new Date(now.getTime() + opts.durationDays * DAY_MS);
        const sub = await this.prisma.farmSubscription.create({
            data: {
                farmId,
                subscriptionPlanId: plan.id,
                status: opts.status,
                startsAt: now,
                expiresAt,
            },
        });
        await this.access.invalidateFarm(farmId);
        this.log.info('Subscription provisioned', {
            farmId,
            plan: opts.planName,
            status: opts.status,
        });
        return sub;
    }
    async provisionTrial(farmId) {
        return this.provision(farmId, {
            planName: subscription_features_1.TRIAL_PLAN_NAME,
            status: client_1.SubscriptionStatus.TRIALING,
            durationDays: subscription_features_1.TRIAL_DURATION_DAYS,
        });
    }
    async ensureUsableSubscription(farmId) {
        return this.provision(farmId, {
            planName: subscription_features_1.PLAN_NAMES.FREE,
            status: client_1.SubscriptionStatus.ACTIVE,
            durationDays: null,
        });
    }
    async downgradeToFree(farmId) {
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { name: subscription_features_1.PLAN_NAMES.FREE },
            select: { id: true },
        });
        if (!plan) {
            this.log.warn('Free plan not seeded — cannot auto-downgrade', {
                farmId,
            });
            return;
        }
        await this.prisma.farmSubscription.create({
            data: {
                farmId,
                subscriptionPlanId: plan.id,
                status: client_1.SubscriptionStatus.ACTIVE,
                startsAt: new Date(),
                expiresAt: null,
            },
        });
        this.log.info('Farm auto-downgraded to Free after expiry', { farmId });
    }
    async runExpirySweep(now = new Date()) {
        const toDowngrade = await this.prisma.farmSubscription.findMany({
            where: {
                status: client_1.SubscriptionStatus.ACTIVE,
                expiresAt: { lte: now },
                pendingPlanId: { not: null },
            },
            select: {
                id: true,
                farmId: true,
                pendingPlanId: true,
                pendingBillingPeriod: true,
            },
        });
        for (const row of toDowngrade) {
            if (!row.pendingPlanId || !row.pendingBillingPeriod)
                continue;
            await this.activate(row.farmId, row.pendingPlanId, row.pendingBillingPeriod);
            this.log.info('Scheduled downgrade applied', {
                farmId: row.farmId,
                planId: row.pendingPlanId,
            });
        }
        const toPastDue = await this.prisma.farmSubscription.findMany({
            where: {
                status: {
                    in: [client_1.SubscriptionStatus.ACTIVE, client_1.SubscriptionStatus.TRIALING],
                },
                expiresAt: { lt: now },
                id: { notIn: toDowngrade.map((r) => r.id) },
            },
            select: { id: true, farmId: true },
        });
        if (toPastDue.length > 0) {
            await this.prisma.farmSubscription.updateMany({
                where: { id: { in: toPastDue.map((s) => s.id) } },
                data: { status: client_1.SubscriptionStatus.PAST_DUE },
            });
        }
        const graceCutoff = new Date(now.getTime() - subscription_features_1.GRACE_PERIOD_DAYS * DAY_MS);
        const toExpired = await this.prisma.farmSubscription.findMany({
            where: {
                status: client_1.SubscriptionStatus.PAST_DUE,
                expiresAt: { lt: graceCutoff },
            },
            select: { id: true, farmId: true },
        });
        if (toExpired.length > 0) {
            await this.prisma.farmSubscription.updateMany({
                where: { id: { in: toExpired.map((s) => s.id) } },
                data: { status: client_1.SubscriptionStatus.EXPIRED },
            });
            for (const row of toExpired) {
                await this.downgradeToFree(row.farmId);
            }
        }
        const affected = new Set([...toPastDue, ...toExpired].map((s) => s.farmId));
        for (const farmId of affected) {
            await this.access.invalidateFarm(farmId);
        }
        await this.sendExpiryEmails(toPastDue, client_1.SubscriptionStatus.PAST_DUE);
        await this.sendExpiryEmails(toExpired, client_1.SubscriptionStatus.EXPIRED);
        const result = {
            pastDue: toPastDue.length,
            expired: toExpired.length,
            downgraded: toDowngrade.length,
        };
        this.log.info('Subscription expiry sweep complete', result);
        return result;
    }
    async sendExpiryEmails(transitions, status) {
        for (const t of transitions) {
            try {
                const farm = await this.prisma.farm.findUnique({
                    where: { id: t.farmId },
                    select: {
                        name: true,
                        owner: { select: { email: true, name: true } },
                    },
                });
                if (!farm?.owner?.email)
                    continue;
                const sub = await this.prisma.farmSubscription.findUnique({
                    where: { id: t.id },
                    select: { expiresAt: true },
                });
                await this.txEmail.sendOnce({
                    idempotencyKey: `subscription_expiry:${t.id}:${status}`,
                    to: farm.owner.email,
                    subject: status === client_1.SubscriptionStatus.EXPIRED
                        ? 'Your Rakhal subscription has expired'
                        : 'Your Rakhal subscription needs attention',
                    template: email_template_enum_1.EmailTemplate.SUBSCRIPTION_EXPIRY,
                    templateData: {
                        name: farm.owner.name ?? farm.name,
                        expiryDate: sub?.expiresAt
                            ? sub.expiresAt.toISOString().slice(0, 10)
                            : '',
                    },
                    tenantId: t.farmId,
                    farmId: t.farmId,
                    userId: null,
                });
            }
            catch {
            }
        }
    }
    async activate(farmId, planId, period) {
        const now = new Date();
        const current = await this.prisma.farmSubscription.findFirst({
            where: { farmId },
            orderBy: { createdAt: 'desc' },
        });
        const extendFrom = current &&
            current.subscriptionPlanId === planId &&
            current.status === client_1.SubscriptionStatus.ACTIVE &&
            current.expiresAt &&
            current.expiresAt > now
            ? current.expiresAt
            : now;
        const sub = await this.prisma.farmSubscription.create({
            data: {
                farmId,
                subscriptionPlanId: planId,
                status: client_1.SubscriptionStatus.ACTIVE,
                startsAt: now,
                expiresAt: addBillingPeriod(extendFrom, period),
            },
        });
        await this.access.invalidateFarm(farmId);
        this.log.info('Subscription activated from paid invoice', {
            farmId,
            planId,
            period,
        });
        return sub;
    }
};
exports.SubscriptionLifecycleService = SubscriptionLifecycleService;
exports.SubscriptionLifecycleService = SubscriptionLifecycleService = SubscriptionLifecycleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        subscription_access_service_1.SubscriptionAccessService,
        transactional_email_service_1.TransactionalEmailService,
        logger_service_1.LoggerService])
], SubscriptionLifecycleService);
//# sourceMappingURL=subscription-lifecycle.service.js.map