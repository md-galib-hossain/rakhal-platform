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
exports.AdminAuditController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
const admin_permission_guard_1 = require("../guards/admin-permission.guard");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
const admin_audit_service_1 = require("../../application/services/admin-audit.service");
const list_admin_audit_dto_1 = require("../dto/list-admin-audit.dto");
let AdminAuditController = class AdminAuditController {
    audit;
    constructor(audit) {
        this.audit = audit;
    }
    list(query) {
        return this.audit.list(query);
    }
};
exports.AdminAuditController = AdminAuditController;
__decorate([
    (0, common_1.Get)(),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('audit.read'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_admin_audit_dto_1.ListAdminAuditQueryDto]),
    __metadata("design:returntype", void 0)
], AdminAuditController.prototype, "list", null);
exports.AdminAuditController = AdminAuditController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Audit'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin/audit'),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [admin_audit_service_1.AdminAuditService])
], AdminAuditController);
//# sourceMappingURL=admin-audit.controller.js.map