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
var RenewalReminderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenewalReminderService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const notification_service_1 = require("src/modules/notification/application/services/notification.service");
const transactional_email_service_1 = require("src/modules/email/application/services/transactional-email.service");
const email_template_enum_1 = require("src/modules/email/domain/enums/email-template.enum");
const renewal_cadence_1 = require("../../domain/renewal-cadence");
const RENEW_LINK = '/subscription';
let RenewalReminderService = RenewalReminderService_1 = class RenewalReminderService {
    prisma;
    notifications;
    txEmail;
    log;
    constructor(prisma, notifications, txEmail, logger) {
        this.prisma = prisma;
        this.notifications = notifications;
        this.txEmail = txEmail;
        this.log = logger.setContext(RenewalReminderService_1.name);
    }
    async runRenewalSweep(now = new Date()) {
        const subs = await this.prisma.farmSubscription.findMany({
            where: {
                status: {
                    in: [
                        client_1.SubscriptionStatus.ACTIVE,
                        client_1.SubscriptionStatus.TRIALING,
                        client_1.SubscriptionStatus.EXPIRED,
                    ],
                },
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true, farmId: true, status: true, expiresAt: true },
        });
        const latest = new Map();
        for (const s of subs)
            if (!latest.has(s.farmId))
                latest.set(s.farmId, s);
        let preExpiry = 0;
        let winback = 0;
        for (const sub of latest.values()) {
            if (!sub.expiresAt)
                continue;
            if (sub.status === client_1.SubscriptionStatus.ACTIVE ||
                sub.status === client_1.SubscriptionStatus.TRIALING) {
                const daysUntil = (0, renewal_cadence_1.calendarDaysBetween)(now, sub.expiresAt);
                if (daysUntil < 0)
                    continue;
                const stage = (0, renewal_cadence_1.preExpiryStageFor)(daysUntil);
                if (stage && (await this.fire(sub, stage, false)))
                    preExpiry += 1;
            }
            else if (sub.status === client_1.SubscriptionStatus.EXPIRED) {
                const daysSince = (0, renewal_cadence_1.calendarDaysBetween)(sub.expiresAt, now);
                const stage = (0, renewal_cadence_1.winbackStageFor)(daysSince);
                if (stage && (await this.fire(sub, stage, true)))
                    winback += 1;
            }
        }
        this.log.info('Renewal sweep complete', { preExpiry, winback });
        return { preExpiry, winback };
    }
    async fire(sub, stage, isWinback) {
        const already = await this.prisma.renewalReminder.findUnique({
            where: { subscriptionId_stage: { subscriptionId: sub.id, stage } },
            select: { id: true },
        });
        if (already)
            return false;
        const farm = await this.prisma.farm.findUnique({
            where: { id: sub.farmId },
            select: {
                name: true,
                owner: { select: { id: true, email: true, name: true } },
            },
        });
        if (!farm?.owner?.email)
            return false;
        const eventKey = isWinback
            ? 'subscription_winback'
            : 'subscription_renewal_reminder';
        let optedOut = false;
        if (isWinback) {
            const pref = await this.prisma.notificationPreference.findFirst({
                where: { userId: farm.owner.id, eventKey },
                select: { enabled: true },
            });
            optedOut = pref ? !pref.enabled : false;
        }
        const channels = [];
        if (!optedOut) {
            const copy = this.copyFor(stage, isWinback);
            const created = await this.notifications.notifyFarmRoles({
                farmId: sub.farmId,
                roleNames: ['Owner'],
                eventKey,
                title: copy.title,
                message: copy.message,
                link: RENEW_LINK,
                dedupeKey: `${eventKey}:${sub.id}:${stage}`,
            });
            if (created.length > 0)
                channels.push('in_app');
            const res = await this.txEmail.sendOnce({
                idempotencyKey: `${eventKey}:${sub.id}:${stage}`,
                to: farm.owner.email,
                subject: copy.subject,
                template: email_template_enum_1.EmailTemplate.SUBSCRIPTION_RENEWAL,
                templateData: {
                    name: farm.owner.name ?? farm.name,
                    headline: copy.headline,
                    body: copy.body,
                    ctaLink: RENEW_LINK,
                },
                tenantId: sub.farmId,
                farmId: sub.farmId,
                userId: farm.owner.id,
            });
            if (res.sent)
                channels.push('email');
        }
        try {
            await this.prisma.renewalReminder.create({
                data: {
                    farmId: sub.farmId,
                    subscriptionId: sub.id,
                    stage,
                    channels,
                },
            });
        }
        catch (err) {
            if (err.code === 'P2002')
                return false;
            throw err;
        }
        return true;
    }
    copyFor(stage, isWinback) {
        if (isWinback) {
            const last = stage === client_1.RenewalStage.WINBACK_30;
            return {
                title: last
                    ? 'Last chance to restore your Rakhal farm'
                    : 'Your Rakhal subscription has expired',
                message: last
                    ? 'Renew now to keep your herd records and reports.'
                    : 'Come back — renew to restore full access to your farm.',
                subject: last
                    ? 'Last chance — restore your Rakhal subscription'
                    : 'We miss you at Rakhal — renew to restore access',
                headline: last
                    ? 'Last chance to come back'
                    : 'Your subscription has expired',
                body: 'Renew any time to restore full access to your dairy-farm operations — no data is lost while you are away.',
            };
        }
        const when = stage === client_1.RenewalStage.EXPIRY_DAY
            ? 'today'
            : stage === client_1.RenewalStage.T_MINUS_1
                ? 'tomorrow'
                : stage === client_1.RenewalStage.T_MINUS_3
                    ? 'in 3 days'
                    : 'in 7 days';
        return {
            title: `Your Rakhal subscription renews ${when}`,
            message: `Renew now to avoid any interruption to your farm access (${when}).`,
            subject: `Your Rakhal subscription expires ${when}`,
            headline: `Your subscription expires ${when}`,
            body: `To keep uninterrupted access to your dairy-farm operations, renew your subscription ${when}. It only takes a moment.`,
        };
    }
};
exports.RenewalReminderService = RenewalReminderService;
exports.RenewalReminderService = RenewalReminderService = RenewalReminderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        transactional_email_service_1.TransactionalEmailService,
        logger_service_1.LoggerService])
], RenewalReminderService);
//# sourceMappingURL=renewal-reminder.service.js.map