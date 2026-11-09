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
exports.BillingController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const billing_service_1 = require("../../application/services/billing.service");
const checkout_dto_1 = require("../dto/checkout.dto");
const list_invoice_query_dto_1 = require("../dto/list-invoice-query.dto");
const refund_invoice_dto_1 = require("../dto/refund-invoice.dto");
const update_billing_profile_dto_1 = require("../dto/update-billing-profile.dto");
const preview_checkout_dto_1 = require("../dto/preview-checkout.dto");
const schedule_downgrade_dto_1 = require("../dto/schedule-downgrade.dto");
const swagger_1 = require("@nestjs/swagger");
let BillingController = class BillingController {
    billing;
    constructor(billing) {
        this.billing = billing;
    }
    checkout(farmId, userId, dto, idempotencyKey) {
        return this.billing.checkout(farmId, userId, dto, idempotencyKey);
    }
    previewCheckout(farmId, userId, dto) {
        return this.billing.previewCheckout(farmId, userId, dto);
    }
    updateProfile(farmId, dto) {
        return this.billing.updateProfile(farmId, dto);
    }
    scheduleDowngrade(farmId, userId, dto) {
        return this.billing.scheduleDowngrade(farmId, userId, dto);
    }
    cancelScheduledDowngrade(farmId, userId) {
        return this.billing.cancelScheduledDowngrade(farmId, userId);
    }
    list(farmId, query) {
        return this.billing.listInvoices(farmId, query);
    }
    getOne(farmId, id) {
        return this.billing.getInvoice(farmId, id);
    }
    async receipt(farmId, id, res) {
        const file = await this.billing.getReceipt(farmId, id);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${file.fileName}"`,
            'Content-Length': String(file.buffer.length),
        });
        res.send(file.buffer);
    }
    refund(farmId, userId, id, dto) {
        return this.billing.refundInvoice(farmId, id, userId, dto.reason);
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Post)('checkout'),
    (0, require_permission_decorator_1.RequirePermission)('subscription.manage'),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 10 } }),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, checkout_dto_1.CheckoutDto, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "checkout", null);
__decorate([
    (0, common_1.Post)('checkout/preview'),
    (0, require_permission_decorator_1.RequirePermission)('subscription.manage'),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 20 } }),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, preview_checkout_dto_1.PreviewCheckoutDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "previewCheckout", null);
__decorate([
    (0, common_1.Patch)('profile'),
    (0, require_permission_decorator_1.RequirePermission)('subscription.manage'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_billing_profile_dto_1.UpdateBillingProfileDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Post)('downgrade/schedule'),
    (0, require_permission_decorator_1.RequirePermission)('subscription.manage'),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 10 } }),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, schedule_downgrade_dto_1.ScheduleDowngradeDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "scheduleDowngrade", null);
__decorate([
    (0, common_1.Post)('downgrade/cancel'),
    (0, require_permission_decorator_1.RequirePermission)('subscription.manage'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "cancelScheduledDowngrade", null);
__decorate([
    (0, common_1.Get)('invoices'),
    (0, require_permission_decorator_1.RequirePermission)('subscription.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_invoice_query_dto_1.ListInvoiceQueryDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('invoices/:id'),
    (0, require_permission_decorator_1.RequirePermission)('subscription.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getOne", null);
__decorate([
    (0, common_1.Get)('invoices/:id/receipt'),
    (0, require_permission_decorator_1.RequirePermission)('subscription.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "receipt", null);
__decorate([
    (0, common_1.Post)('invoices/:id/refund'),
    (0, require_permission_decorator_1.RequirePermission)('subscription.manage'),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 5 } }),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, refund_invoice_dto_1.RefundInvoiceDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "refund", null);
exports.BillingController = BillingController = __decorate([
    (0, swagger_1.ApiTags)('Billing'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('billing'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [billing_service_1.BillingService])
], BillingController);
//# sourceMappingURL=billing.controller.js.map