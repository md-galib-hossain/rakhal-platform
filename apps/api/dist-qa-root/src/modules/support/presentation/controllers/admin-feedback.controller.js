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
exports.AdminFeedbackController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const admin_ip_allowlist_guard_1 = require("src/modules/admin/presentation/guards/admin-ip-allowlist.guard");
const platform_admin_guard_1 = require("src/modules/admin/presentation/guards/platform-admin.guard");
const admin_permission_guard_1 = require("src/modules/admin/presentation/guards/admin-permission.guard");
const admin_audit_service_1 = require("src/modules/admin/application/services/admin-audit.service");
const require_admin_permission_decorator_1 = require("src/modules/admin/presentation/decorators/require-admin-permission.decorator");
const current_admin_decorator_1 = require("src/modules/admin/presentation/decorators/current-admin.decorator");
const feedback_service_1 = require("../../application/services/feedback.service");
const list_feedback_query_dto_1 = require("../dto/list-feedback-query.dto");
const update_feedback_dto_1 = require("../dto/update-feedback.dto");
let AdminFeedbackController = class AdminFeedbackController {
    feedback;
    audit;
    constructor(feedback, audit) {
        this.feedback = feedback;
        this.audit = audit;
    }
    list(query) {
        return this.feedback.listForAdmin(query.status);
    }
    async update(admin, id, dto) {
        const updated = await this.feedback.updateStatus(id, admin.id, dto);
        await this.audit.record({
            adminId: admin.id,
            action: 'FEEDBACK_UPDATED',
            entityType: 'SupportFeedback',
            entityId: id,
            metadata: { fields: Object.keys(dto) },
        });
        return updated;
    }
};
exports.AdminFeedbackController = AdminFeedbackController;
__decorate([
    (0, common_1.Get)(),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('feedback.read'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_feedback_query_dto_1.ListFeedbackQueryDto]),
    __metadata("design:returntype", void 0)
], AdminFeedbackController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('feedback.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_feedback_dto_1.UpdateFeedbackDto]),
    __metadata("design:returntype", Promise)
], AdminFeedbackController.prototype, "update", null);
exports.AdminFeedbackController = AdminFeedbackController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Support'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin/feedback'),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [feedback_service_1.FeedbackService,
        admin_audit_service_1.AdminAuditService])
], AdminFeedbackController);
//# sourceMappingURL=admin-feedback.controller.js.map