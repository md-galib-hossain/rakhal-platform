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
var ReconciliationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconciliationService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const payment_provider_port_1 = require("../ports/payment-provider.port");
const DAY_MS = 24 * 60 * 60 * 1000;
let ReconciliationService = ReconciliationService_1 = class ReconciliationService {
    prisma;
    provider;
    log;
    constructor(prisma, provider, logger) {
        this.prisma = prisma;
        this.provider = provider;
        this.log = logger.setContext(ReconciliationService_1.name);
    }
    async runReconciliation(now = new Date(), lookbackDays = 7) {
        if (!this.provider.isConfigured()) {
            return { checked: 0, flagged: 0, skipped: 'no gateway configured' };
        }
        const cutoff = new Date(now.getTime() - lookbackDays * DAY_MS);
        const payments = (await this.prisma.payment.findMany({
            where: { providerPaymentId: { not: null }, createdAt: { gte: cutoff } },
            select: {
                id: true,
                invoiceId: true,
                farmId: true,
                providerPaymentId: true,
                amount: true,
                status: true,
            },
        }));
        let flagged = 0;
        const completedByInvoice = new Map();
        for (const p of payments) {
            if (p.status === client_1.PaymentStatus.COMPLETED) {
                const list = completedByInvoice.get(p.invoiceId) ?? [];
                list.push(p.id);
                completedByInvoice.set(p.invoiceId, list);
            }
        }
        for (const [invoiceId, ids] of completedByInvoice) {
            for (const extraId of ids.slice(1)) {
                const p = payments.find((x) => x.id === extraId);
                flagged += (await this.raise({
                    paymentId: p.id,
                    invoiceId,
                    farmId: p.farmId,
                    providerPaymentId: p.providerPaymentId,
                    type: client_1.ReconciliationType.DUPLICATE,
                    detail: `Multiple COMPLETED payments for invoice ${invoiceId}`,
                }))
                    ? 1
                    : 0;
            }
        }
        for (const p of payments) {
            if (!p.providerPaymentId)
                continue;
            let result;
            try {
                result = await this.provider.queryPayment(p.providerPaymentId);
            }
            catch (err) {
                this.log.warn('Reconciliation query failed; will retry next run', {
                    paymentId: p.id,
                    err: err.message,
                });
                continue;
            }
            const gatewayCompleted = result.status === 'COMPLETED';
            if (gatewayCompleted && p.status !== client_1.PaymentStatus.COMPLETED) {
                flagged += (await this.raise({
                    paymentId: p.id,
                    invoiceId: p.invoiceId,
                    farmId: p.farmId,
                    providerPaymentId: p.providerPaymentId,
                    type: client_1.ReconciliationType.PAID_NOT_SETTLED,
                    expectedAmount: p.amount,
                    actualAmount: result.amount ?? null,
                    detail: `Gateway reports Completed but our payment is ${p.status} (missed callback?)`,
                }))
                    ? 1
                    : 0;
            }
            else if (gatewayCompleted &&
                result.amount != null &&
                !new client_1.Prisma.Decimal(result.amount).equals(p.amount)) {
                flagged += (await this.raise({
                    paymentId: p.id,
                    invoiceId: p.invoiceId,
                    farmId: p.farmId,
                    providerPaymentId: p.providerPaymentId,
                    type: client_1.ReconciliationType.AMOUNT_MISMATCH,
                    expectedAmount: p.amount,
                    actualAmount: result.amount,
                    detail: `Gateway amount ${result.amount} ≠ recorded ${p.amount.toString()}`,
                }))
                    ? 1
                    : 0;
            }
            else if (!gatewayCompleted && p.status === client_1.PaymentStatus.COMPLETED) {
                flagged += (await this.raise({
                    paymentId: p.id,
                    invoiceId: p.invoiceId,
                    farmId: p.farmId,
                    providerPaymentId: p.providerPaymentId,
                    type: client_1.ReconciliationType.STATUS_MISMATCH,
                    expectedAmount: p.amount,
                    actualAmount: result.amount ?? null,
                    detail: `Our payment is COMPLETED but the gateway reports ${result.status}`,
                }))
                    ? 1
                    : 0;
            }
        }
        this.log.info('Settlement reconciliation complete', {
            checked: payments.length,
            flagged,
        });
        return { checked: payments.length, flagged };
    }
    async raise(input) {
        try {
            await this.prisma.reconciliationException.create({
                data: {
                    paymentId: input.paymentId,
                    invoiceId: input.invoiceId,
                    farmId: input.farmId,
                    providerPaymentId: input.providerPaymentId,
                    type: input.type,
                    expectedAmount: input.expectedAmount ?? null,
                    actualAmount: input.actualAmount != null
                        ? new client_1.Prisma.Decimal(input.actualAmount)
                        : null,
                    detail: input.detail,
                },
            });
            this.log.warn('Reconciliation exception raised', {
                paymentId: input.paymentId,
                type: input.type,
            });
            return true;
        }
        catch (err) {
            if (err.code === 'P2002')
                return false;
            throw err;
        }
    }
    async list(filters) {
        const rows = await this.prisma.reconciliationException.findMany({
            where: {
                ...(filters.status ? { status: filters.status } : {}),
                ...(filters.type ? { type: filters.type } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        return rows.map((r) => this.present(r));
    }
    async resolve(id, adminId, status, note) {
        const existing = await this.prisma.reconciliationException.findUnique({
            where: { id },
        });
        if (!existing)
            throw new common_1.NotFoundException('Reconciliation exception not found');
        const updated = await this.prisma.reconciliationException.update({
            where: { id },
            data: {
                status,
                resolvedByAdminId: adminId,
                resolvedAt: new Date(),
                resolutionNote: note ?? existing.resolutionNote,
            },
        });
        return this.present(updated);
    }
    present(r) {
        return {
            id: r.id,
            type: r.type,
            status: r.status,
            payment_id: r.paymentId,
            invoice_id: r.invoiceId,
            farm_id: r.farmId,
            provider_payment_id: r.providerPaymentId,
            expected_amount: r.expectedAmount ? r.expectedAmount.toNumber() : null,
            actual_amount: r.actualAmount ? r.actualAmount.toNumber() : null,
            detail: r.detail,
            resolved_by_admin_id: r.resolvedByAdminId,
            resolved_at: r.resolvedAt ? r.resolvedAt.toISOString() : null,
            resolution_note: r.resolutionNote,
            created_at: r.createdAt.toISOString(),
        };
    }
};
exports.ReconciliationService = ReconciliationService;
exports.ReconciliationService = ReconciliationService = ReconciliationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(payment_provider_port_1.PAYMENT_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object, logger_service_1.LoggerService])
], ReconciliationService);
//# sourceMappingURL=reconciliation.service.js.map