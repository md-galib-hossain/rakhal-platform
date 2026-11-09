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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BkashCallbackController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const env_1 = require("src/core/config/env");
const billing_service_1 = require("../../application/services/billing.service");
const swagger_1 = require("@nestjs/swagger");
let BkashCallbackController = class BkashCallbackController {
    billing;
    constructor(billing) {
        this.billing = billing;
    }
    async callback(paymentID, status, res) {
        let outcome = 'failed';
        if (status === 'success' && paymentID) {
            const result = await this.billing.finalizePayment(paymentID);
            outcome =
                result.status === 'PAID' || result.status === 'ALREADY_PAID'
                    ? 'success'
                    : 'failed';
        }
        const sep = env_1.env.BKASH_RETURN_URL.includes('?') ? '&' : '?';
        res.redirect(`${env_1.env.BKASH_RETURN_URL}${sep}status=${outcome}`);
    }
};
exports.BkashCallbackController = BkashCallbackController;
__decorate([
    (0, common_1.Get)('callback'),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 20 } }),
    __param(0, (0, common_1.Query)('paymentID')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], BkashCallbackController.prototype, "callback", null);
exports.BkashCallbackController = BkashCallbackController = __decorate([
    (0, swagger_1.ApiTags)('Billing'),
    (0, common_1.Controller)('billing/bkash'),
    __metadata("design:paramtypes", [billing_service_1.BillingService])
], BkashCallbackController);
//# sourceMappingURL=bkash-callback.controller.js.map