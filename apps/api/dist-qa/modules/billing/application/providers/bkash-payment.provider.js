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
var BkashPaymentProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BkashPaymentProvider = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const env_1 = require("src/core/config/env");
const bkash_token_service_1 = require("../services/bkash-token.service");
let BkashPaymentProvider = BkashPaymentProvider_1 = class BkashPaymentProvider {
    tokens;
    gateway = client_1.PaymentGateway.BKASH;
    log;
    constructor(tokens, logger) {
        this.tokens = tokens;
        this.log = logger.setContext(BkashPaymentProvider_1.name);
    }
    isConfigured() {
        return Boolean(env_1.env.BKASH_BASE_URL &&
            env_1.env.BKASH_APP_KEY &&
            env_1.env.BKASH_APP_SECRET &&
            env_1.env.BKASH_USERNAME &&
            env_1.env.BKASH_PASSWORD);
    }
    async createPayment(input) {
        const body = await this.post('/tokenized/checkout/create', {
            mode: '0011',
            payerReference: input.farmId,
            callbackURL: env_1.env.BKASH_CALLBACK_URL ?? '',
            amount: input.amount.toString(),
            currency: input.currency,
            intent: 'sale',
            merchantInvoiceNumber: input.invoiceId,
        });
        if (!body.paymentID) {
            throw new Error(`bKash create failed: ${body.statusMessage ?? body.statusCode ?? 'unknown'}`);
        }
        return {
            providerPaymentId: body.paymentID,
            redirectUrl: body.bkashURL ?? null,
        };
    }
    async executePayment(providerPaymentId) {
        const body = await this.post('/tokenized/checkout/execute', {
            paymentID: providerPaymentId,
        });
        return this.mapStatus(body);
    }
    async queryPayment(providerPaymentId) {
        const body = await this.post('/tokenized/checkout/payment/status', {
            paymentID: providerPaymentId,
        });
        return this.mapStatus(body);
    }
    async refund(input) {
        const body = await this.post('/tokenized/checkout/payment/refund', {
            paymentID: input.providerPaymentId,
            amount: input.amount.toString(),
            reason: input.reason ?? 'refund',
            sku: 'subscription',
        });
        return {
            refundTrxId: body.refundTrxID ?? body.trxID ?? '',
            status: body.transactionStatus ?? body.statusCode ?? 'unknown',
        };
    }
    mapStatus(body) {
        const ts = body.transactionStatus;
        const status = ts === 'Completed'
            ? 'COMPLETED'
            : ts === 'Initiated'
                ? 'PENDING'
                : 'FAILED';
        return {
            status,
            providerTrxId: body.trxID ?? null,
            amount: body.amount != null ? Number(body.amount) : null,
        };
    }
    async post(path, payload) {
        const token = await this.tokens.getToken();
        const res = await fetch(`${env_1.env.BKASH_BASE_URL}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                authorization: token,
                'x-app-key': env_1.env.BKASH_APP_KEY ?? '',
            },
            body: JSON.stringify(payload),
        });
        return (await res.json());
    }
};
exports.BkashPaymentProvider = BkashPaymentProvider;
exports.BkashPaymentProvider = BkashPaymentProvider = BkashPaymentProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [bkash_token_service_1.BkashTokenService,
        logger_service_1.LoggerService])
], BkashPaymentProvider);
//# sourceMappingURL=bkash-payment.provider.js.map