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
exports.FeedItemController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const feed_item_service_1 = require("../../application/services/feed-item.service");
const bulk_delete_feed_item_dto_1 = require("../dto/bulk-delete-feed-item.dto");
const create_feed_item_dto_1 = require("../dto/create-feed-item.dto");
const create_feed_item_batch_dto_1 = require("../dto/create-feed-item-batch.dto");
const feed_batch_code_query_dto_1 = require("../dto/feed-batch-code-query.dto");
const update_feed_batch_nutrition_dto_1 = require("../dto/update-feed-batch-nutrition.dto");
const list_feed_item_query_dto_1 = require("../dto/list-feed-item-query.dto");
const update_feed_item_dto_1 = require("../dto/update-feed-item.dto");
const swagger_1 = require("@nestjs/swagger");
let FeedItemController = class FeedItemController {
    feedItemService;
    constructor(feedItemService) {
        this.feedItemService = feedItemService;
    }
    create(farmId, userId, dto) {
        return this.feedItemService.create(farmId, userId, dto);
    }
    bulkDelete(farmId, userId, dto) {
        return this.feedItemService.removeMany(farmId, dto.ids, userId);
    }
    byBatchCode(farmId, query) {
        return this.feedItemService.findByBatchCode(farmId, query.code);
    }
    findAll(farmId, query) {
        return this.feedItemService.findAll(farmId, query);
    }
    findOne(farmId, id) {
        return this.feedItemService.findOne(farmId, id);
    }
    update(farmId, userId, id, dto) {
        return this.feedItemService.update(farmId, userId, id, dto);
    }
    createBatch(farmId, userId, id, dto) {
        return this.feedItemService.createBatch(farmId, userId, id, dto);
    }
    reviseNutrition(farmId, userId, id, batchId, dto) {
        return this.feedItemService.reviseBatchNutrition(farmId, userId, id, batchId, dto);
    }
    revertNutrition(farmId, userId, id, batchId) {
        return this.feedItemService.revertBatchNutrition(farmId, userId, id, batchId);
    }
    resyncNutrition(farmId, userId, id, batchId) {
        return this.feedItemService.resyncBatchNutrition(farmId, userId, id, batchId);
    }
    archive(farmId, userId, id) {
        return this.feedItemService.archive(farmId, id, userId);
    }
    restore(farmId, userId, id) {
        return this.feedItemService.restore(farmId, id, userId);
    }
    remove(farmId, userId, id) {
        return this.feedItemService.remove(farmId, id, userId);
    }
};
exports.FeedItemController = FeedItemController;
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('inventory.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_feed_item_dto_1.CreateFeedItemDto]),
    __metadata("design:returntype", void 0)
], FeedItemController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('bulk-delete'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, bulk_delete_feed_item_dto_1.BulkDeleteFeedItemDto]),
    __metadata("design:returntype", void 0)
], FeedItemController.prototype, "bulkDelete", null);
__decorate([
    (0, common_1.Get)('by-batch-code'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, feed_batch_code_query_dto_1.FeedBatchCodeQueryDto]),
    __metadata("design:returntype", void 0)
], FeedItemController.prototype, "byBatchCode", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('inventory.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_feed_item_query_dto_1.ListFeedItemQueryDto]),
    __metadata("design:returntype", void 0)
], FeedItemController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FeedItemController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, update_feed_item_dto_1.UpdateFeedItemDto]),
    __metadata("design:returntype", void 0)
], FeedItemController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/batches'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, create_feed_item_batch_dto_1.CreateFeedItemBatchDto]),
    __metadata("design:returntype", void 0)
], FeedItemController.prototype, "createBatch", null);
__decorate([
    (0, common_1.Patch)(':id/batches/:batchId/nutrition'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Param)('batchId')),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, update_feed_batch_nutrition_dto_1.UpdateFeedBatchNutritionDto]),
    __metadata("design:returntype", void 0)
], FeedItemController.prototype, "reviseNutrition", null);
__decorate([
    (0, common_1.Post)(':id/batches/:batchId/nutrition/revert'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], FeedItemController.prototype, "revertNutrition", null);
__decorate([
    (0, common_1.Post)(':id/batches/:batchId/nutrition/resync'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], FeedItemController.prototype, "resyncNutrition", null);
__decorate([
    (0, common_1.Patch)(':id/archive'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], FeedItemController.prototype, "archive", null);
__decorate([
    (0, common_1.Patch)(':id/restore'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], FeedItemController.prototype, "restore", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('inventory.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], FeedItemController.prototype, "remove", null);
exports.FeedItemController = FeedItemController = __decorate([
    (0, swagger_1.ApiTags)('Inventory'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('inventory/feed-items'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [feed_item_service_1.FeedItemService])
], FeedItemController);
//# sourceMappingURL=feed-item.controller.js.map