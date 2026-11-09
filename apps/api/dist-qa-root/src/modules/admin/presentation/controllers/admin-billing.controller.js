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
exports.AdminBillingController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const swagger_1 = require("@nestjs/swagger");
const coupon_service_1 = require("src/modules/billing/application/services/coupon.service");
const referral_service_1 = require("src/modules/billing/application/services/referral.service");
const plan_catalogue_service_1 = require("src/modules/subscription/application/services/plan-catalogue.service");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
const admin_permission_guard_1 = require("../guards/admin-permission.guard");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
const current_admin_decorator_1 = require("../decorators/current-admin.decorator");
const admin_audit_service_1 = require("../../application/services/admin-audit.service");
const admin_issue_coupon_dto_1 = require("../dto/admin-issue-coupon.dto");
let AdminBillingController = class AdminBillingController {
    coupons;
    referrals;
    plans;
    audit;
    constructor(coupons, referrals, plans, audit) {
        this.coupons = coupons;
        this.referrals = referrals;
        this.plans = plans;
        this.audit = audit;
    }
    listPlans() {
        return this.plans.listPlans();
    }
    listCoupons(status) {
        return this.coupons.list(status);
    }
    async issueCoupon(admin, dto, req) {
        const coupon = await this.coupons.issue({
            code: dto.code,
            type: dto.type,
            value: dto.value,
            maxRedemptions: dto.maxRedemptions,
            perFarmLimit: dto.perFarmLimit,
            validFrom: new Date(dto.validFrom),
            validUntil: new Date(dto.validUntil),
            applicablePlanIds: dto.applicablePlanIds,
            minSpend: dto.minSpend,
        });
        await this.audit.record({
            adminId: admin.id,
            action: 'COUPON_ISSUED',
            entityType: 'Coupon',
            entityId: coupon.id,
            metadata: { code: coupon.code, maxRedemptions: coupon.maxRedemptions },
            ipAddress: req.ip,
        });
        return coupon;
    }
    async disableCoupon(admin, id, req) {
        const coupon = await this.coupons.disable(id);
        await this.audit.record({
            adminId: admin.id,
            action: 'COUPON_DISABLED',
            entityType: 'Coupon',
            entityId: coupon.id,
            metadata: { code: coupon.code },
            ipAddress: req.ip,
        });
        return coupon;
    }
    listCommissions(status) {
        return this.referrals.listAllCommissions(status);
    }
};
exports.AdminBillingController = AdminBillingController;
__decorate([
    (0, common_1.Get)('plans'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('plan.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminBillingController.prototype, "listPlans", null);
__decorate([
    (0, common_1.Get)('coupons'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('coupon.read'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminBillingController.prototype, "listCoupons", null);
__decorate([
    (0, common_1.Post)('coupons'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('coupon.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, admin_issue_coupon_dto_1.AdminIssueCouponDto, Object]),
    __metadata("design:returntype", Promise)
], AdminBillingController.prototype, "issueCoupon", null);
__decorate([
    (0, common_1.Post)('coupons/:id/disable'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('coupon.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AdminBillingController.prototype, "disableCoupon", null);
__decorate([
    (0, common_1.Get)('referrals/commissions'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('referral.read'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminBillingController.prototype, "listCommissions", null);
exports.AdminBillingController = AdminBillingController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Billing'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [coupon_service_1.CouponService,
        referral_service_1.ReferralService,
        plan_catalogue_service_1.PlanCatalogueService,
        admin_audit_service_1.AdminAuditService])
], AdminBillingController);
//# sourceMappingURL=admin-billing.controller.js.map