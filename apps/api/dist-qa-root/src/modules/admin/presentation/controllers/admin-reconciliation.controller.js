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
exports.AdminReconciliationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const reconciliation_service_1 = require("src/modules/billing/application/services/reconciliation.service");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
const admin_permission_guard_1 = require("../guards/admin-permission.guard");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
const current_admin_decorator_1 = require("../decorators/current-admin.decorator");
const admin_audit_service_1 = require("../../application/services/admin-audit.service");
const reconciliation_dto_1 = require("../dto/reconciliation.dto");
let AdminReconciliationController = class AdminReconciliationController {
    reconciliation;
    audit;
    constructor(reconciliation, audit) {
        this.reconciliation = reconciliation;
        this.audit = audit;
    }
    list(query) {
        return this.reconciliation.list({ status: query.status, type: query.type });
    }
    async run(admin, req) {
        const result = await this.reconciliation.runReconciliation();
        await this.audit.record({
            adminId: admin.id,
            action: 'RECONCILIATION_RUN',
            entityType: 'ReconciliationException',
            metadata: result,
            ipAddress: req.ip,
        });
        return result;
    }
    async resolve(admin, id, dto, req) {
        const exception = await this.reconciliation.resolve(id, admin.id, dto.status, dto.note);
        await this.audit.record({
            adminId: admin.id,
            action: 'RECONCILIATION_RESOLVED',
            entityType: 'ReconciliationException',
            entityId: id,
            metadata: { status: dto.status },
            ipAddress: req.ip,
        });
        return exception;
    }
};
exports.AdminReconciliationController = AdminReconciliationController;
__decorate([
    (0, common_1.Get)(),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('reconciliation.read'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [reconciliation_dto_1.ListReconciliationQueryDto]),
    __metadata("design:returntype", void 0)
], AdminReconciliationController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('run'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('reconciliation.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminReconciliationController.prototype, "run", null);
__decorate([
    (0, common_1.Post)(':id/resolve'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('reconciliation.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reconciliation_dto_1.ResolveReconciliationDto, Object]),
    __metadata("design:returntype", Promise)
], AdminReconciliationController.prototype, "resolve", null);
exports.AdminReconciliationController = AdminReconciliationController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Reconciliation'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin/reconciliation'),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [reconciliation_service_1.ReconciliationService,
        admin_audit_service_1.AdminAuditService])
], AdminReconciliationController);
//# sourceMappingURL=admin-reconciliation.controller.js.map