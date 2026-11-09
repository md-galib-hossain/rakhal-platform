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
exports.AdminFeedIngredientController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const feed_ingredient_service_1 = require("src/modules/feed/application/services/feed-ingredient.service");
const create_catalogue_ingredient_dto_1 = require("src/modules/feed/presentation/dto/create-catalogue-ingredient.dto");
const update_catalogue_ingredient_dto_1 = require("src/modules/feed/presentation/dto/update-catalogue-ingredient.dto");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
const admin_permission_guard_1 = require("../guards/admin-permission.guard");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
const current_admin_decorator_1 = require("../decorators/current-admin.decorator");
const admin_audit_service_1 = require("../../application/services/admin-audit.service");
let AdminFeedIngredientController = class AdminFeedIngredientController {
    ingredients;
    audit;
    constructor(ingredients, audit) {
        this.ingredients = ingredients;
        this.audit = audit;
    }
    list() {
        return this.ingredients.listCatalogueForAdmin();
    }
    async create(admin, dto, req) {
        const ingredient = await this.ingredients.createCatalogueIngredient(dto);
        await this.audit.record({
            adminId: admin.id,
            action: 'FEED_INGREDIENT_CREATED',
            entityType: 'FeedIngredient',
            entityId: ingredient.id,
            metadata: {
                name_en: ingredient.name_en,
                feed_class: ingredient.feed_class,
            },
            ipAddress: req.ip,
        });
        return ingredient;
    }
    async update(admin, id, dto, req) {
        const ingredient = await this.ingredients.updateCatalogueIngredient(id, dto);
        await this.audit.record({
            adminId: admin.id,
            action: 'FEED_INGREDIENT_UPDATED',
            entityType: 'FeedIngredient',
            entityId: ingredient.id,
            metadata: { fields: Object.keys(dto) },
            ipAddress: req.ip,
        });
        return ingredient;
    }
    async archive(admin, id, req) {
        const ingredient = await this.ingredients.setCatalogueIngredientActive(id, false);
        await this.audit.record({
            adminId: admin.id,
            action: 'FEED_INGREDIENT_ARCHIVED',
            entityType: 'FeedIngredient',
            entityId: ingredient.id,
            ipAddress: req.ip,
        });
        return ingredient;
    }
    async restore(admin, id, req) {
        const ingredient = await this.ingredients.setCatalogueIngredientActive(id, true);
        await this.audit.record({
            adminId: admin.id,
            action: 'FEED_INGREDIENT_RESTORED',
            entityType: 'FeedIngredient',
            entityId: ingredient.id,
            ipAddress: req.ip,
        });
        return ingredient;
    }
};
exports.AdminFeedIngredientController = AdminFeedIngredientController;
__decorate([
    (0, common_1.Get)(),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('feed-ingredient.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminFeedIngredientController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('feed-ingredient.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_catalogue_ingredient_dto_1.CreateCatalogueIngredientDto, Object]),
    __metadata("design:returntype", Promise)
], AdminFeedIngredientController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('feed-ingredient.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_catalogue_ingredient_dto_1.UpdateCatalogueIngredientDto, Object]),
    __metadata("design:returntype", Promise)
], AdminFeedIngredientController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('feed-ingredient.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AdminFeedIngredientController.prototype, "archive", null);
__decorate([
    (0, common_1.Post)(':id/restore'),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('feed-ingredient.manage'),
    __param(0, (0, current_admin_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AdminFeedIngredientController.prototype, "restore", null);
exports.AdminFeedIngredientController = AdminFeedIngredientController = __decorate([
    (0, swagger_1.ApiTags)('Admin — Feed Ingredients'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin/feed-ingredients'),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [feed_ingredient_service_1.FeedIngredientService,
        admin_audit_service_1.AdminAuditService])
], AdminFeedIngredientController);
//# sourceMappingURL=admin-feed-ingredient.controller.js.map