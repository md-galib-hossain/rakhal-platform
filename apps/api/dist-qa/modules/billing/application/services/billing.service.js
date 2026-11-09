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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var BillingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const env_1 = require("src/core/config/env");
const audit_service_1 = require("src/modules/audit/application/services/audit.service");
const subscription_lifecycle_service_1 = require("src/modules/subscription/application/services/subscription-lifecycle.service");
const subscription_features_1 = require("src/modules/subscription/domain/subscription-features");
const money_1 = require("../../domain/money");
const invoice_number_1 = require("../../domain/invoice-number");
const payment_provider_port_1 = require("../ports/payment-provider.port");
const coupon_service_1 = require("./coupon.service");
const referral_service_1 = require("./referral.service");
const credit_wallet_service_1 = require("./credit-wallet.service");
const receipt_service_1 = require("./receipt.service");
const legal_consent_service_1 = require("src/modules/compliance/application/services/legal-consent.service");
const transactional_email_service_1 = require("src/modules/email/application/services/transactional-email.service");
const email_template_enum_1 = require("src/modules/email/domain/enums/email-template.enum");
let BillingService = BillingService_1 = class BillingService {
    prisma;
    audit;
    lifecycle;
    coupons;
    referrals;
    creditWallet;
    receipts;
    legal;
    txEmail;
    provider;
    log;
    constructor(prisma, audit, lifecycle, coupons, referrals, creditWallet, receipts, legal, txEmail, provider, logger) {
        this.prisma = prisma;
        this.audit = audit;
        this.lifecycle = lifecycle;
        this.coupons = coupons;
        this.referrals = referrals;
        this.creditWallet = creditWallet;
        this.receipts = receipts;
        this.legal = legal;
        this.txEmail = txEmail;
        this.provider = provider;
        this.log = logger.setContext(BillingService_1.name);
    }
    async checkout(farmId, userId, dto, idempotencyKey) {
        await this.legal.assertConsent(userId);
        const key = idempotencyKey?.trim() || (0, node_crypto_1.randomUUID)();
        const existing = await this.prisma.invoice.findUnique({
            where: { farmId_idempotencyKey: { farmId, idempotencyKey: key } },
        });
        if (existing) {
            return {
                invoice: this.present(existing),
                checkout: null,
                idempotent: true,
            };
        }
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id: dto.planId },
        });
        if (!plan)
            throw new common_1.NotFoundException('Subscription plan not found');
        const isFreePlan = plan.name === subscription_features_1.PLAN_NAMES.FREE;
        if (isFreePlan) {
            const farm = await this.prisma.farm.findUniqueOrThrow({
                where: { id: farmId },
                select: { phone: true, address: true, freePlanActivatedAt: true },
            });
            if (!farm.phone || !farm.address) {
                throw new common_1.ForbiddenException('Complete your farm profile (phone and address) before activating the Free plan');
            }
            if (farm.freePlanActivatedAt) {
                throw new common_1.ConflictException('The Free plan has already been activated for this farm');
            }
        }
        const subtotal = dto.billingPeriod === client_1.BillingPeriod.YEARLY
            ? (plan.yearlyPrice ?? plan.monthlyPrice.times(12))
            : plan.monthlyPrice;
        const user = dto.couponCode
            ? await this.prisma.user.findUnique({
                where: { id: userId },
                select: { phoneVerifiedAt: true },
            })
            : null;
        const vatRate = new client_1.Prisma.Decimal(env_1.env.VAT_ENABLED ? env_1.env.VAT_RATE : 0);
        const invoice = await this.prisma.$transaction(async (tx) => {
            let discountTotal = new client_1.Prisma.Decimal(0);
            let couponId = null;
            if (dto.couponCode) {
                const reservation = await this.coupons.reserve(tx, {
                    code: dto.couponCode,
                    farmId,
                    planId: plan.id,
                    subtotal,
                    phoneVerifiedAt: user?.phoneVerifiedAt ?? null,
                });
                discountTotal = reservation.discount;
                couponId = reservation.couponId;
            }
            const netAfterDiscount = (0, money_1.clampNonNegative)(subtotal.minus(discountTotal));
            const taxAmount = (0, money_1.computeTax)(netAfterDiscount, vatRate);
            const grossWithTax = netAfterDiscount.plus(taxAmount);
            const referralCreditApplied = await this.creditWallet.applyToCharge(tx, farmId, grossWithTax, 'subscription');
            const counter = await tx.invoiceCounter.upsert({
                where: { scope: invoice_number_1.INVOICE_COUNTER_SCOPE },
                create: { scope: invoice_number_1.INVOICE_COUNTER_SCOPE, value: 1 },
                update: { value: { increment: 1 } },
            });
            const invoiceNumber = (0, invoice_number_1.formatInvoiceNumber)(env_1.env.INVOICE_NUMBER_PREFIX, counter.value);
            const created = await tx.invoice.create({
                data: this.buildInvoiceData({
                    farmId,
                    subscriptionPlanId: plan.id,
                    billingPeriod: dto.billingPeriod,
                    subtotal,
                    discountTotal,
                    taxRate: vatRate,
                    taxAmount,
                    couponId,
                    referralCreditApplied,
                    invoiceNumber,
                    idempotencyKey: key,
                }),
            });
            if (couponId) {
                await this.coupons.recordRedemption(tx, {
                    couponId,
                    farmId,
                    invoiceId: created.id,
                    discount: discountTotal,
                });
            }
            if (isFreePlan) {
                const flip = await tx.farm.updateMany({
                    where: { id: farmId, freePlanActivatedAt: null },
                    data: { freePlanActivatedAt: new Date() },
                });
                if (flip.count === 0) {
                    throw new common_1.ConflictException('The Free plan has already been activated for this farm');
                }
            }
            return created;
        });
        const redeemedCouponId = invoice.couponId;
        const total = invoice.total;
        const isFree = total.isZero();
        await this.audit.record({
            actorUserId: userId,
            action: client_1.AuditAction.INVOICE_CREATED,
            entityType: 'Invoice',
            entityId: invoice.id,
            farmId,
            metadata: { total: total.toNumber(), status: invoice.status },
        });
        if (redeemedCouponId) {
            await this.audit.record({
                actorUserId: userId,
                action: client_1.AuditAction.COUPON_REDEEMED,
                entityType: 'Coupon',
                entityId: redeemedCouponId,
                farmId,
                metadata: {
                    invoiceId: invoice.id,
                    discount: invoice.discountTotal.toNumber(),
                },
            });
        }
        if (isFree) {
            await this.lifecycle.activate(farmId, plan.id, dto.billingPeriod);
            await this.audit.record({
                actorUserId: userId,
                action: client_1.AuditAction.INVOICE_PAID,
                entityType: 'Invoice',
                entityId: invoice.id,
                farmId,
                metadata: { total: 0 },
            });
            await this.receipts.emailReceipt(invoice.id);
            return {
                invoice: this.present(invoice),
                checkout: null,
                idempotent: false,
            };
        }
        const payment = await this.prisma.payment.create({
            data: {
                invoiceId: invoice.id,
                farmId,
                provider: this.provider.gateway,
                amount: total,
                status: client_1.PaymentStatus.INITIATED,
                idempotencyKey: `${key}:pay`,
            },
        });
        await this.audit.record({
            actorUserId: userId,
            action: client_1.AuditAction.PAYMENT_INITIATED,
            entityType: 'Payment',
            entityId: payment.id,
            farmId,
            metadata: { amount: total.toNumber(), provider: this.provider.gateway },
        });
        if (this.provider.isConfigured()) {
            try {
                const res = await this.provider.createPayment({
                    invoiceId: invoice.id,
                    farmId,
                    amount: total.toNumber(),
                    currency: 'BDT',
                });
                await this.prisma.payment.update({
                    where: { id: payment.id },
                    data: { providerPaymentId: res.providerPaymentId },
                });
                return {
                    invoice: this.present(invoice),
                    checkout: {
                        provider: this.provider.gateway,
                        provider_payment_id: res.providerPaymentId,
                        redirect_url: res.redirectUrl ?? null,
                    },
                    idempotent: false,
                };
            }
            catch (err) {
                this.log.error('Gateway payment initiation failed', err, {
                    farmId,
                    invoiceId: invoice.id,
                });
                return {
                    invoice: this.present(invoice),
                    checkout: { provider_configured: true, initiation_failed: true },
                    idempotent: false,
                };
            }
        }
        this.log.warn('Checkout created a PENDING invoice with no gateway configured', {
            farmId,
            invoiceId: invoice.id,
        });
        return {
            invoice: this.present(invoice),
            checkout: { provider_configured: false },
            idempotent: false,
        };
    }
    async listInvoices(farmId, query) {
        const rows = await this.prisma.invoice.findMany({
            where: { farmId },
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        return { items: page.items.map((i) => this.present(i)), meta: page.meta };
    }
    async getInvoice(farmId, id) {
        const invoice = await this.prisma.invoice.findFirst({
            where: { id, farmId },
        });
        if (!invoice)
            throw new common_1.NotFoundException('Invoice not found');
        return this.present(invoice);
    }
    async finalizePayment(providerPaymentId) {
        const payment = await this.prisma.payment.findFirst({
            where: { providerPaymentId },
        });
        if (!payment)
            return { status: 'UNKNOWN' };
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: payment.invoiceId },
        });
        if (!invoice)
            return { status: 'UNKNOWN' };
        if (invoice.status === client_1.InvoiceStatus.PAID)
            return { status: 'ALREADY_PAID' };
        let result;
        try {
            result = await this.provider.executePayment(providerPaymentId, payment.idempotencyKey);
        }
        catch (err) {
            this.log.error('Payment execution failed', err, {
                invoiceId: invoice.id,
            });
            await this.failPayment(payment.id, invoice);
            return { status: 'FAILED' };
        }
        const amountOk = result.amount == null ||
            new client_1.Prisma.Decimal(result.amount).equals(invoice.total);
        if (result.status === 'COMPLETED' && amountOk) {
            const flip = await this.prisma.invoice.updateMany({
                where: { id: invoice.id, status: { not: client_1.InvoiceStatus.PAID } },
                data: { status: client_1.InvoiceStatus.PAID, paidAt: new Date() },
            });
            if (flip.count === 0)
                return { status: 'ALREADY_PAID' };
            await this.prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: client_1.PaymentStatus.COMPLETED,
                    providerTrxId: result.providerTrxId ?? null,
                },
            });
            await this.lifecycle.activate(invoice.farmId, invoice.subscriptionPlanId, invoice.billingPeriod);
            if (invoice.total.gt(0)) {
                await this.referrals.accrueOnFirstPaidInvoice(invoice.farmId, invoice.id);
            }
            const actorUserId = await this.farmOwnerId(invoice.farmId);
            if (actorUserId) {
                await this.audit.record({
                    actorUserId,
                    action: client_1.AuditAction.PAYMENT_COMPLETED,
                    entityType: 'Payment',
                    entityId: payment.id,
                    farmId: invoice.farmId,
                    metadata: {
                        trxId: result.providerTrxId,
                        amount: invoice.total.toNumber(),
                    },
                });
                await this.audit.record({
                    actorUserId,
                    action: client_1.AuditAction.INVOICE_PAID,
                    entityType: 'Invoice',
                    entityId: invoice.id,
                    farmId: invoice.farmId,
                    metadata: { total: invoice.total.toNumber() },
                });
            }
            await this.receipts.emailReceipt(invoice.id);
            return { status: 'PAID' };
        }
        if (!amountOk) {
            this.log.error('Payment amount mismatch — refusing to mark PAID', undefined, {
                invoiceId: invoice.id,
                expected: invoice.total.toNumber(),
                got: result.amount,
            });
        }
        await this.failPayment(payment.id, invoice);
        return { status: 'FAILED' };
    }
    async refundInvoice(farmId, invoiceId, actorUserId, reason) {
        const invoice = await this.prisma.invoice.findFirst({
            where: { id: invoiceId, farmId },
        });
        if (!invoice)
            throw new common_1.NotFoundException('Invoice not found');
        if (invoice.status === client_1.InvoiceStatus.REFUNDED)
            return this.present(invoice);
        if (invoice.status !== client_1.InvoiceStatus.PAID) {
            throw new common_1.NotFoundException('Only a paid invoice can be refunded');
        }
        const payment = await this.prisma.payment.findFirst({
            where: { invoiceId, status: client_1.PaymentStatus.COMPLETED },
            orderBy: { createdAt: 'desc' },
        });
        if (!payment?.providerPaymentId) {
            throw new common_1.NotFoundException('No completed gateway payment found for this invoice');
        }
        await this.provider.refund({
            providerPaymentId: payment.providerPaymentId,
            amount: invoice.total.toNumber(),
            reason,
        });
        const [updated] = await this.prisma.$transaction([
            this.prisma.invoice.update({
                where: { id: invoice.id },
                data: { status: client_1.InvoiceStatus.REFUNDED },
            }),
            this.prisma.payment.update({
                where: { id: payment.id },
                data: { status: client_1.PaymentStatus.REFUNDED },
            }),
        ]);
        await this.audit.record({
            actorUserId,
            action: client_1.AuditAction.REFUND_ISSUED,
            entityType: 'Invoice',
            entityId: invoice.id,
            farmId,
            metadata: { amount: invoice.total.toNumber(), reason: reason ?? null },
        });
        await this.referrals.clawback(invoice.id, actorUserId);
        return this.present(updated);
    }
    async failPayment(paymentId, invoice) {
        await this.prisma.payment.update({
            where: { id: paymentId },
            data: { status: client_1.PaymentStatus.FAILED },
        });
        if (invoice.status !== client_1.InvoiceStatus.PAID) {
            await this.prisma.invoice.update({
                where: { id: invoice.id },
                data: { status: client_1.InvoiceStatus.FAILED },
            });
        }
        const actorUserId = await this.farmOwnerId(invoice.farmId);
        if (actorUserId) {
            await this.audit.record({
                actorUserId,
                action: client_1.AuditAction.PAYMENT_FAILED,
                entityType: 'Payment',
                entityId: paymentId,
                farmId: invoice.farmId,
            });
            const owner = await this.prisma.user.findUnique({
                where: { id: actorUserId },
                select: { email: true, name: true },
            });
            if (owner) {
                await this.txEmail
                    .sendOnce({
                    idempotencyKey: `payment_failed:${paymentId}`,
                    to: owner.email,
                    subject: 'Your Rakhal payment could not be completed',
                    template: email_template_enum_1.EmailTemplate.PAYMENT_FAILED,
                    templateData: {
                        name: owner.name,
                        amount: `${invoice.currency} ${invoice.total.toFixed(2)}`,
                    },
                    tenantId: invoice.farmId,
                    farmId: invoice.farmId,
                    userId: actorUserId,
                })
                    .catch(() => undefined);
            }
        }
    }
    buildInvoiceData(p) {
        const total = (0, money_1.computeGrandTotal)(p.subtotal, p.discountTotal, p.taxAmount, p.referralCreditApplied);
        const isFree = total.isZero();
        return {
            farmId: p.farmId,
            subscriptionPlanId: p.subscriptionPlanId,
            billingPeriod: p.billingPeriod,
            currency: 'BDT',
            subtotal: p.subtotal,
            discountTotal: p.discountTotal,
            referralCreditApplied: p.referralCreditApplied,
            taxRate: p.taxRate,
            taxAmount: p.taxAmount,
            invoiceNumber: p.invoiceNumber,
            sellerName: env_1.env.INVOICE_SELLER_NAME,
            sellerAddress: env_1.env.INVOICE_SELLER_ADDRESS,
            sellerBin: env_1.env.INVOICE_SELLER_BIN ?? null,
            placeOfSupply: env_1.env.INVOICE_PLACE_OF_SUPPLY,
            total,
            couponId: p.couponId,
            status: isFree ? client_1.InvoiceStatus.PAID : client_1.InvoiceStatus.PENDING,
            idempotencyKey: p.idempotencyKey,
            paidAt: isFree ? new Date() : null,
        };
    }
    getReceipt(farmId, invoiceId) {
        return this.receipts.renderForDownload(farmId, invoiceId);
    }
    async previewCheckout(farmId, userId, dto) {
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id: dto.planId },
        });
        if (!plan)
            throw new common_1.NotFoundException('Subscription plan not found');
        const subtotal = dto.billingPeriod === client_1.BillingPeriod.YEARLY
            ? (plan.yearlyPrice ?? plan.monthlyPrice.times(12))
            : plan.monthlyPrice;
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { phoneVerifiedAt: true },
        });
        const { discount } = await this.coupons.preview({
            code: dto.couponCode,
            farmId,
            planId: plan.id,
            subtotal,
            phoneVerifiedAt: user?.phoneVerifiedAt ?? null,
        });
        const vatRate = new client_1.Prisma.Decimal(env_1.env.VAT_ENABLED ? env_1.env.VAT_RATE : 0);
        const netAfterDiscount = (0, money_1.clampNonNegative)(subtotal.minus(discount));
        const taxAmount = (0, money_1.computeTax)(netAfterDiscount, vatRate);
        const grossWithTax = netAfterDiscount.plus(taxAmount);
        const walletBalance = await this.creditWallet.getBalance(farmId);
        const estimatedCreditApplied = client_1.Prisma.Decimal.min(walletBalance, grossWithTax);
        const total = (0, money_1.computeGrandTotal)(subtotal, discount, taxAmount, estimatedCreditApplied);
        return {
            plan_id: plan.id,
            billing_period: dto.billingPeriod,
            currency: 'BDT',
            subtotal: subtotal.toNumber(),
            discount_total: discount.toNumber(),
            estimated_credit_applied: estimatedCreditApplied.toNumber(),
            tax_rate: vatRate.toNumber(),
            tax_amount: taxAmount.toNumber(),
            total: total.toNumber(),
        };
    }
    async updateProfile(farmId, dto) {
        const updated = await this.prisma.farm.update({
            where: { id: farmId },
            data: {
                phone: dto.phone,
                address: dto.address,
                ...(dto.farm_name ? { name: dto.farm_name } : {}),
            },
            select: { id: true, name: true, phone: true, address: true },
        });
        return {
            farm_id: updated.id,
            farm_name: updated.name,
            phone: updated.phone,
            address: updated.address,
        };
    }
    async scheduleDowngrade(farmId, userId, dto) {
        const current = await this.prisma.farmSubscription.findFirst({
            where: { farmId },
            orderBy: { createdAt: 'desc' },
        });
        if (!current || current.status !== 'ACTIVE' || !current.expiresAt) {
            throw new common_1.BadRequestException('No active subscription to schedule a change against');
        }
        const [currentPlan, targetPlan] = await Promise.all([
            this.prisma.subscriptionPlan.findUnique({
                where: { id: current.subscriptionPlanId },
            }),
            this.prisma.subscriptionPlan.findUnique({ where: { id: dto.planId } }),
        ]);
        if (!targetPlan)
            throw new common_1.NotFoundException('Subscription plan not found');
        if (!currentPlan) {
            throw new common_1.NotFoundException('Current subscription plan not found');
        }
        if (targetPlan.monthlyPrice.gte(currentPlan.monthlyPrice)) {
            throw new common_1.BadRequestException('Use checkout for an upgrade or same-tier plan');
        }
        const updated = await this.prisma.farmSubscription.update({
            where: { id: current.id },
            data: {
                pendingPlanId: targetPlan.id,
                pendingBillingPeriod: dto.billingPeriod,
                pendingScheduledBy: userId,
            },
        });
        await this.audit.record({
            actorUserId: userId,
            action: client_1.AuditAction.SUBSCRIPTION_DOWNGRADE_SCHEDULED,
            entityType: 'FarmSubscription',
            entityId: updated.id,
            farmId,
            metadata: {
                targetPlanId: targetPlan.id,
                effectiveAt: current.expiresAt.toISOString(),
            },
        });
        return {
            pending_plan_id: targetPlan.id,
            pending_plan_name: targetPlan.name,
            pending_billing_period: dto.billingPeriod,
            effective_at: current.expiresAt.toISOString(),
        };
    }
    async cancelScheduledDowngrade(farmId, userId) {
        const current = await this.prisma.farmSubscription.findFirst({
            where: { farmId, pendingPlanId: { not: null } },
            orderBy: { createdAt: 'desc' },
        });
        if (!current)
            return;
        await this.prisma.farmSubscription.update({
            where: { id: current.id },
            data: {
                pendingPlanId: null,
                pendingBillingPeriod: null,
                pendingScheduledBy: null,
            },
        });
        await this.audit.record({
            actorUserId: userId,
            action: client_1.AuditAction.SUBSCRIPTION_DOWNGRADE_CANCELLED,
            entityType: 'FarmSubscription',
            entityId: current.id,
            farmId,
        });
    }
    async farmOwnerId(farmId) {
        const farm = await this.prisma.farm.findUnique({
            where: { id: farmId },
            select: { ownerId: true },
        });
        return farm?.ownerId ?? null;
    }
    present(invoice) {
        return {
            id: invoice.id,
            invoice_number: invoice.invoiceNumber,
            plan_id: invoice.subscriptionPlanId,
            billing_period: invoice.billingPeriod,
            currency: invoice.currency,
            subtotal: invoice.subtotal.toNumber(),
            discount_total: invoice.discountTotal.toNumber(),
            referral_credit_applied: (invoice.referralCreditApplied ?? new client_1.Prisma.Decimal(0)).toNumber(),
            tax_rate: invoice.taxRate.toNumber(),
            tax_amount: invoice.taxAmount.toNumber(),
            total: invoice.total.toNumber(),
            status: invoice.status,
            paid_at: invoice.paidAt ? invoice.paidAt.toISOString() : null,
            created_at: invoice.createdAt.toISOString(),
        };
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = BillingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(9, (0, common_1.Inject)(payment_provider_port_1.PAYMENT_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        subscription_lifecycle_service_1.SubscriptionLifecycleService,
        coupon_service_1.CouponService,
        referral_service_1.ReferralService,
        credit_wallet_service_1.CreditWalletService,
        receipt_service_1.ReceiptService,
        legal_consent_service_1.LegalConsentService,
        transactional_email_service_1.TransactionalEmailService, Object, logger_service_1.LoggerService])
], BillingService);
//# sourceMappingURL=billing.service.js.map