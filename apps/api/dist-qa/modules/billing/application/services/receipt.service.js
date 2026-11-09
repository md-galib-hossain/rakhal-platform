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
var ReceiptService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const env_1 = require("src/core/config/env");
const email_service_1 = require("src/modules/email/application/services/email.service");
const email_template_enum_1 = require("src/modules/email/domain/enums/email-template.enum");
const receipt_pdf_renderer_1 = require("../../domain/receipt-pdf-renderer");
const receipt_pdf_1 = require("../../domain/receipt-pdf");
let ReceiptService = ReceiptService_1 = class ReceiptService {
    prisma;
    email;
    log;
    constructor(prisma, email, logger) {
        this.prisma = prisma;
        this.email = email;
        this.log = logger.setContext(ReceiptService_1.name);
    }
    async renderForDownload(farmId, invoiceId) {
        const invoice = await this.prisma.invoice.findFirst({
            where: { id: invoiceId, farmId },
        });
        if (!invoice)
            throw new common_1.NotFoundException('Invoice not found');
        if (invoice.status !== client_1.InvoiceStatus.PAID &&
            invoice.status !== client_1.InvoiceStatus.REFUNDED) {
            throw new common_1.NotFoundException('A receipt is only available for a paid invoice');
        }
        return this.render(invoice);
    }
    async emailReceipt(invoiceId) {
        try {
            const invoice = await this.prisma.invoice.findUnique({
                where: { id: invoiceId },
            });
            if (!invoice)
                return;
            const farm = await this.prisma.farm.findUnique({
                where: { id: invoice.farmId },
                select: { name: true, owner: { select: { email: true, name: true } } },
            });
            const to = farm?.owner?.email;
            if (!to) {
                this.log.warn('No owner email for receipt — skipping', { invoiceId });
                return;
            }
            const receipt = await this.render(invoice, farm.name ?? undefined);
            await this.email.queue({
                to,
                subject: `Your Rakhal payment receipt ${receipt.invoiceNumber}`,
                template: email_template_enum_1.EmailTemplate.PAYMENT_RECEIPT,
                templateData: {
                    receiptId: receipt.invoiceNumber,
                    name: farm?.owner?.name ?? farm?.name ?? 'there',
                    total: `${invoice.currency} ${invoice.total.toFixed(2)}`,
                },
                tenantId: invoice.farmId,
                farmId: invoice.farmId,
                userId: null,
                correlationId: (0, node_crypto_1.randomUUID)(),
                attachments: [
                    {
                        filename: receipt.fileName,
                        contentBase64: receipt.buffer.toString('base64'),
                        contentType: 'application/pdf',
                    },
                ],
            });
        }
        catch (err) {
            this.log.error('Failed to email payment receipt', err, { invoiceId });
        }
    }
    async render(invoice, farmName) {
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id: invoice.subscriptionPlanId },
            select: { name: true },
        });
        const buyerName = farmName ??
            (await this.prisma.farm.findUnique({
                where: { id: invoice.farmId },
                select: { name: true },
            }))?.name ??
            invoice.farmId;
        const invoiceNumber = invoice.invoiceNumber ?? invoice.id;
        const input = {
            invoiceNumber,
            planName: plan?.name ?? 'Subscription',
            billingPeriod: invoice.billingPeriod,
            buyerName,
            sellerName: invoice.sellerName ?? env_1.env.INVOICE_SELLER_NAME,
            sellerAddress: invoice.sellerAddress ?? env_1.env.INVOICE_SELLER_ADDRESS,
            sellerBin: invoice.sellerBin ?? env_1.env.INVOICE_SELLER_BIN ?? null,
            placeOfSupply: invoice.placeOfSupply ?? env_1.env.INVOICE_PLACE_OF_SUPPLY,
            currency: invoice.currency,
            subtotal: invoice.subtotal.toNumber(),
            discountTotal: invoice.discountTotal.toNumber(),
            referralCreditApplied: (invoice.referralCreditApplied ?? new client_1.Prisma.Decimal(0)).toNumber(),
            taxRate: invoice.taxRate.toNumber(),
            taxAmount: invoice.taxAmount.toNumber(),
            total: invoice.total.toNumber(),
            status: invoice.status,
            paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
            issuedAt: invoice.createdAt.toISOString(),
        };
        const buffer = await (0, receipt_pdf_renderer_1.renderReceiptPdf)((0, receipt_pdf_1.buildReceiptReportData)(input));
        return {
            fileName: `receipt-${invoiceNumber}.pdf`,
            buffer: Buffer.from(buffer),
            invoiceNumber,
        };
    }
};
exports.ReceiptService = ReceiptService;
exports.ReceiptService = ReceiptService = ReceiptService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService,
        logger_service_1.LoggerService])
], ReceiptService);
//# sourceMappingURL=receipt.service.js.map