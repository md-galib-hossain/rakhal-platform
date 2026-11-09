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
var ReferralService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const audit_service_1 = require("src/modules/audit/application/services/audit.service");
const referral_program_1 = require("../../domain/referral-program");
const credit_wallet_service_1 = require("./credit-wallet.service");
let ReferralService = ReferralService_1 = class ReferralService {
    prisma;
    audit;
    creditWallet;
    log;
    constructor(prisma, audit, creditWallet, logger) {
        this.prisma = prisma;
        this.audit = audit;
        this.creditWallet = creditWallet;
        this.log = logger.setContext(ReferralService_1.name);
    }
    async getOrCreateCode(farmId, userId) {
        const existing = await this.prisma.referralCode.findFirst({
            where: { farmId, active: true },
        });
        if (existing)
            return existing;
        const code = await this.uniqueCode();
        return this.prisma.referralCode.create({
            data: { farmId, ownerUserId: userId, code },
        });
    }
    async bindReferral(referredFarmId, referredOwnerUserId, code) {
        const referralCode = await this.prisma.referralCode.findUnique({
            where: { code: code.trim().toUpperCase() },
        });
        if (!referralCode || !referralCode.active)
            return;
        const isSelfReferral = referralCode.ownerUserId === referredOwnerUserId;
        const windowStart = new Date(Date.now() -
            referral_program_1.DEFAULT_REFERRAL_PROGRAM.velocityWindowHours * 60 * 60 * 1000);
        const recentCount = await this.prisma.referral.count({
            where: { referralCodeId: referralCode.id, boundAt: { gte: windowStart } },
        });
        const flagged = !isSelfReferral &&
            recentCount >= referral_program_1.DEFAULT_REFERRAL_PROGRAM.velocityCapPerWindow;
        try {
            await this.prisma.referral.create({
                data: {
                    referralCodeId: referralCode.id,
                    referrerFarmId: referralCode.farmId,
                    referredFarmId,
                    status: isSelfReferral ? client_1.ReferralStatus.VOID : client_1.ReferralStatus.PENDING,
                    flagged,
                    flagReason: isSelfReferral
                        ? 'self-referral'
                        : flagged
                            ? 'velocity cap exceeded'
                            : null,
                },
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                return;
            }
            throw err;
        }
        await this.audit.record({
            actorUserId: referredOwnerUserId,
            action: client_1.AuditAction.REFERRAL_BOUND,
            entityType: 'Referral',
            entityId: referredFarmId,
            farmId: referredFarmId,
            metadata: {
                referrerFarmId: referralCode.farmId,
                selfReferral: isSelfReferral,
                flagged,
            },
        });
    }
    async accrueOnFirstPaidInvoice(farmId, invoiceId) {
        try {
            const referral = await this.prisma.referral.findUnique({
                where: { referredFarmId: farmId },
            });
            if (!referral || referral.status === client_1.ReferralStatus.VOID)
                return;
            const priorPaid = await this.prisma.invoice.findFirst({
                where: {
                    farmId,
                    status: 'PAID',
                    total: { gt: 0 },
                    id: { not: invoiceId },
                },
                select: { id: true },
            });
            if (priorPaid)
                return;
            const approve = referral_program_1.DEFAULT_REFERRAL_PROGRAM.creditingEnabled && !referral.flagged;
            let commission;
            try {
                commission = await this.prisma.referralCommission.create({
                    data: {
                        referrerFarmId: referral.referrerFarmId,
                        referredFarmId: farmId,
                        triggerInvoiceId: invoiceId,
                        amount: referral_program_1.DEFAULT_REFERRAL_PROGRAM.rewardAmount,
                        status: approve
                            ? client_1.CommissionStatus.APPROVED
                            : client_1.CommissionStatus.PENDING,
                        idempotencyKey: invoiceId,
                    },
                });
            }
            catch (err) {
                if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                    err.code === 'P2002') {
                    return;
                }
                throw err;
            }
            if (approve) {
                await this.prisma.$transaction(async (tx) => {
                    await this.creditWallet.credit(referral.referrerFarmId, commission.amount, tx);
                    await tx.referral.update({
                        where: { id: referral.id },
                        data: {
                            status: client_1.ReferralStatus.REWARDED,
                            qualifiedAt: new Date(),
                        },
                    });
                });
            }
            else {
                await this.prisma.referral.update({
                    where: { id: referral.id },
                    data: { status: client_1.ReferralStatus.QUALIFIED, qualifiedAt: new Date() },
                });
            }
            const referrerOwnerId = await this.farmOwnerId(referral.referrerFarmId);
            await this.audit.record({
                actorUserId: referrerOwnerId ?? referral.referrerFarmId,
                action: client_1.AuditAction.REFERRAL_COMMISSION_ACCRUED,
                entityType: 'ReferralCommission',
                entityId: commission.id,
                farmId: referral.referrerFarmId,
                metadata: {
                    referredFarmId: farmId,
                    amount: commission.amount.toNumber(),
                    held: !approve,
                },
            });
            this.log.info('Referral commission accrued', {
                referrerFarmId: referral.referrerFarmId,
                referredFarmId: farmId,
                held: !approve,
            });
        }
        catch (err) {
            this.log.error('Referral commission accrual failed', err, {
                farmId,
                invoiceId,
            });
        }
    }
    async clawback(invoiceId, actorUserId) {
        const commission = await this.prisma.referralCommission.findUnique({
            where: { idempotencyKey: invoiceId },
        });
        if (!commission ||
            commission.status === client_1.CommissionStatus.CLAWED_BACK ||
            commission.status === client_1.CommissionStatus.PENDING) {
            return;
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.referralCommission.update({
                where: { id: commission.id },
                data: {
                    status: client_1.CommissionStatus.CLAWED_BACK,
                    clawedBackAt: new Date(),
                },
            });
            await this.creditWallet.debit(commission.referrerFarmId, commission.amount, { allowNegative: true, db: tx });
        });
        await this.audit.record({
            actorUserId,
            action: client_1.AuditAction.REFERRAL_CLAWED_BACK,
            entityType: 'ReferralCommission',
            entityId: commission.id,
            farmId: commission.referrerFarmId,
            metadata: {
                invoiceId,
                amount: commission.amount.toNumber(),
            },
        });
    }
    async getReferralsForFarm(farmId, userId) {
        const code = await this.getOrCreateCode(farmId, userId);
        const [referrals, balance] = await Promise.all([
            this.prisma.referral.findMany({
                where: { referrerFarmId: farmId },
                orderBy: { boundAt: 'desc' },
            }),
            this.creditWallet.getBalance(farmId),
        ]);
        return {
            code: code.code,
            active: code.active,
            wallet_balance: balance.toNumber(),
            referred_farms: referrals.map((r) => ({
                farm_id: r.referredFarmId,
                status: r.status,
                flagged: r.flagged,
                bound_at: r.boundAt.toISOString(),
                qualified_at: r.qualifiedAt ? r.qualifiedAt.toISOString() : null,
            })),
        };
    }
    async getCommissionsForFarm(farmId) {
        const commissions = await this.prisma.referralCommission.findMany({
            where: { referrerFarmId: farmId },
            orderBy: { createdAt: 'desc' },
        });
        return commissions.map((c) => ({
            id: c.id,
            referred_farm_id: c.referredFarmId,
            reward_type: c.rewardType,
            amount: c.amount.toNumber(),
            status: c.status,
            created_at: c.createdAt.toISOString(),
            clawed_back_at: c.clawedBackAt ? c.clawedBackAt.toISOString() : null,
        }));
    }
    async listAllCommissions(status) {
        const commissions = await this.prisma.referralCommission.findMany({
            where: status ? { status } : undefined,
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        return commissions.map((c) => ({
            id: c.id,
            referrer_farm_id: c.referrerFarmId,
            referred_farm_id: c.referredFarmId,
            trigger_invoice_id: c.triggerInvoiceId,
            reward_type: c.rewardType,
            amount: c.amount.toNumber(),
            status: c.status,
            created_at: c.createdAt.toISOString(),
            clawed_back_at: c.clawedBackAt ? c.clawedBackAt.toISOString() : null,
        }));
    }
    async farmOwnerId(farmId) {
        const farm = await this.prisma.farm.findUnique({
            where: { id: farmId },
            select: { ownerId: true },
        });
        return farm?.ownerId ?? null;
    }
    async uniqueCode() {
        for (let attempt = 0; attempt < 20; attempt++) {
            const candidate = (0, node_crypto_1.randomBytes)(6).toString('hex').toUpperCase();
            const taken = await this.prisma.referralCode.findUnique({
                where: { code: candidate },
            });
            if (!taken)
                return candidate;
        }
        throw new common_1.ConflictException('Could not generate a unique referral code');
    }
};
exports.ReferralService = ReferralService;
exports.ReferralService = ReferralService = ReferralService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        credit_wallet_service_1.CreditWalletService,
        logger_service_1.LoggerService])
], ReferralService);
//# sourceMappingURL=referral.service.js.map