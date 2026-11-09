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
exports.FeedController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const subscription_feature_guard_1 = require("src/modules/subscription/presentation/guards/subscription-feature.guard");
const require_feature_decorator_1 = require("src/modules/subscription/presentation/decorators/require-feature.decorator");
const feed_concentration_service_1 = require("../../application/services/feed-concentration.service");
const feed_ingredient_service_1 = require("../../application/services/feed-ingredient.service");
const feed_requirements_service_1 = require("../../application/services/feed-requirements.service");
const requirement_settings_service_1 = require("../../application/services/requirement-settings.service");
const feed_distribution_service_1 = require("../../application/services/feed-distribution.service");
const feed_stock_service_1 = require("../../application/services/feed-stock.service");
const feed_ration_resolver_service_1 = require("../../application/services/feed-ration-resolver.service");
const bulk_delete_stock_dto_1 = require("../dto/bulk-delete-stock.dto");
const concentration_dto_1 = require("../dto/concentration.dto");
const list_ingredients_query_dto_1 = require("../dto/list-ingredients-query.dto");
const list_feed_stock_query_dto_1 = require("../dto/list-feed-stock-query.dto");
const feed_requirements_query_dto_1 = require("../dto/feed-requirements-query.dto");
const update_requirement_settings_dto_1 = require("../dto/update-requirement-settings.dto");
const set_feed_override_dto_1 = require("../dto/set-feed-override.dto");
const create_custom_ingredient_dto_1 = require("../dto/create-custom-ingredient.dto");
const update_custom_ingredient_dto_1 = require("../dto/update-custom-ingredient.dto");
const log_distribution_dto_1 = require("../dto/log-distribution.dto");
const patch_refusal_dto_1 = require("../dto/patch-refusal.dto");
const update_stock_nutrition_dto_1 = require("../dto/update-stock-nutrition.dto");
const feed_grid_calendar_query_dto_1 = require("../dto/feed-grid-calendar-query.dto");
const list_distribution_query_dto_1 = require("../dto/list-distribution-query.dto");
const feed_grid_query_dto_1 = require("../dto/feed-grid-query.dto");
const save_feed_draft_dto_1 = require("../dto/save-feed-draft.dto");
const confirm_feed_draft_dto_1 = require("../dto/confirm-feed-draft.dto");
const feed_cattle_history_query_dto_1 = require("../dto/feed-cattle-history-query.dto");
const void_feed_cattle_item_dto_1 = require("../dto/void-feed-cattle-item.dto");
const feed_feeding_grid_service_1 = require("../../application/services/feed-feeding-grid.service");
const feed_plan_service_1 = require("../../application/services/feed-plan.service");
const swagger_1 = require("@nestjs/swagger");
let FeedController = class FeedController {
    ingredients;
    requirements;
    requirementSettings;
    concentrations;
    distributions;
    stock;
    rationResolver;
    feedingGrid;
    plans;
    constructor(ingredients, requirements, requirementSettings, concentrations, distributions, stock, rationResolver, feedingGrid, plans) {
        this.ingredients = ingredients;
        this.requirements = requirements;
        this.requirementSettings = requirementSettings;
        this.concentrations = concentrations;
        this.distributions = distributions;
        this.stock = stock;
        this.rationResolver = rationResolver;
        this.feedingGrid = feedingGrid;
        this.plans = plans;
    }
    listIngredients(farmId, query) {
        return this.ingredients.listMerged(farmId, query.includeArchived);
    }
    listIngredientsPaged(farmId, query) {
        return this.ingredients.listPaged(farmId, query);
    }
    createCustomIngredient(farmId, userId, dto) {
        return this.ingredients.createCustom(farmId, userId, dto);
    }
    updateCustomIngredient(farmId, id, dto) {
        return this.ingredients.updateCustomIngredient(farmId, id, dto);
    }
    deactivateCustomIngredient(farmId, id) {
        return this.ingredients.deactivateCustomIngredient(farmId, id);
    }
    setOverride(farmId, userId, id, dto) {
        return this.ingredients.setOverride(farmId, userId, id, dto);
    }
    resetOverride(farmId, id) {
        return this.ingredients.resetOverride(farmId, id);
    }
    getRequirements(farmId, query) {
        if (query.cattleIds?.length)
            return this.requirements.forCattle(farmId, query.cattleIds, query.date);
        return this.requirements.calc(farmId, query);
    }
    todaysRequirement(farmId) {
        return this.requirements.getTodaysRequirement(farmId);
    }
    getRequirementSettings(farmId) {
        return this.requirementSettings.describe(farmId);
    }
    updateRequirementSettings(farmId, userId, dto) {
        return this.requirementSettings.saveFarmChanges(farmId, userId, dto.changes, dto.notes);
    }
    resetRequirementSettings(farmId, userId) {
        return this.requirementSettings.resetFarmChanges(farmId, userId);
    }
    listConcentrations(farmId, query) {
        return this.concentrations.list(farmId, query.kind, query.includeArchived);
    }
    createConcentration(farmId, userId, dto) {
        return this.concentrations.create(farmId, userId, dto);
    }
    normalize(farmId, dto) {
        return this.concentrations.normalize(farmId, dto);
    }
    bulkDeleteConcentrations(farmId, dto) {
        return this.concentrations.removeMany(farmId, dto.ids);
    }
    getConcentration(farmId, id) {
        return this.concentrations.get(farmId, id);
    }
    updateConcentration(farmId, id, dto) {
        return this.concentrations.update(farmId, id, dto);
    }
    removeConcentration(farmId, id) {
        return this.concentrations.remove(farmId, id);
    }
    saveVersion(farmId, userId, id, name) {
        return this.concentrations.saveAsVersion(farmId, userId, id, name);
    }
    listVersions(farmId, id) {
        return this.concentrations.listVersions(farmId, id);
    }
    finalizeConcentration(farmId, userId, id, dto) {
        return this.concentrations.finalize(farmId, userId, id, dto.batchQuantityKg);
    }
    concentrationInventoryCheck(farmId, id) {
        return this.concentrations.inventoryCheck(farmId, id);
    }
    async resolvedRation(farmId, cattleId) {
        const resolved = await this.rationResolver.resolveActiveRation(farmId, cattleId);
        if (!resolved)
            return { match_level: null, concentration: null };
        return {
            match_level: resolved.matchLevel,
            concentration: await this.concentrations.get(farmId, resolved.concentration.id),
        };
    }
    programForCattle(farmId, cattleId) {
        return this.plans.programForCattle(farmId, cattleId);
    }
    dmiComparison(farmId, cattleId, date) {
        return this.distributions.getDmiComparison(farmId, cattleId, date);
    }
    listDistributions(farmId, query) {
        return this.distributions.list(farmId, query);
    }
    logDistribution(farmId, userId, dto) {
        return this.distributions.create(farmId, userId, dto);
    }
    getFeedingGrid(farmId, query) {
        return this.feedingGrid.getGrid(farmId, query.date);
    }
    getFeedingGridCalendar(farmId, query) {
        return this.feedingGrid.calendar(farmId, query.month);
    }
    saveFeedDraft(farmId, userId, dto) {
        return this.feedingGrid.saveDraft(farmId, userId, dto);
    }
    confirmFeedDraft(farmId, userId, dto) {
        return this.feedingGrid.confirm(farmId, userId, dto);
    }
    getCattleHistory(farmId, cattleId, query) {
        return this.feedingGrid.cattleHistory(farmId, cattleId, query.date);
    }
    voidCattleItem(farmId, userId, distributionId, cattleItemId, dto) {
        return this.feedingGrid.voidCattleItem(farmId, userId, distributionId, cattleItemId, dto);
    }
    costSummary(farmId, days) {
        return this.distributions.getFarmFeedCostSummary(farmId, days ? Number(days) : undefined);
    }
    efficiency(farmId, query) {
        return this.distributions.efficiency(farmId, query);
    }
    getDistribution(farmId, id) {
        return this.distributions.get(farmId, id);
    }
    patchRefusal(farmId, id, dto) {
        return this.distributions.patchRefusal(farmId, id, dto);
    }
    listStock(farmId, query) {
        return this.stock.list(farmId, query.includeArchived);
    }
    bulkDeleteStock(farmId, dto) {
        return this.stock.removeMany(farmId, dto.ids);
    }
    getStock(farmId, id) {
        return this.stock.get(farmId, id);
    }
    archiveStock(farmId, id) {
        return this.stock.archive(farmId, id);
    }
    updateStockNutrition(farmId, userId, id, dto) {
        return this.stock.updateNutrition(farmId, userId, id, dto);
    }
};
exports.FeedController = FeedController;
__decorate([
    (0, common_1.Get)('ingredients'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_ingredients_query_dto_1.ListIngredientsQueryDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "listIngredients", null);
__decorate([
    (0, common_1.Get)('ingredients/paged'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_ingredients_query_dto_1.ListIngredientsQueryDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "listIngredientsPaged", null);
__decorate([
    (0, common_1.Post)('ingredients/custom'),
    (0, require_permission_decorator_1.RequirePermission)('feed.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_custom_ingredient_dto_1.CreateCustomIngredientDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "createCustomIngredient", null);
__decorate([
    (0, common_1.Patch)('ingredients/custom/:id'),
    (0, require_permission_decorator_1.RequirePermission)('feed.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_custom_ingredient_dto_1.UpdateCustomIngredientDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "updateCustomIngredient", null);
__decorate([
    (0, common_1.Delete)('ingredients/custom/:id'),
    (0, require_permission_decorator_1.RequirePermission)('feed.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "deactivateCustomIngredient", null);
__decorate([
    (0, common_1.Post)('ingredients/:id/override'),
    (0, require_permission_decorator_1.RequirePermission)('feed.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, set_feed_override_dto_1.SetFeedOverrideDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "setOverride", null);
__decorate([
    (0, common_1.Delete)('ingredients/:id/override'),
    (0, require_permission_decorator_1.RequirePermission)('feed.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "resetOverride", null);
__decorate([
    (0, common_1.Get)('requirements'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, feed_requirements_query_dto_1.FeedRequirementsQueryDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "getRequirements", null);
__decorate([
    (0, common_1.Get)('today-requirement'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "todaysRequirement", null);
__decorate([
    (0, common_1.Get)('requirement-settings'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "getRequirementSettings", null);
__decorate([
    (0, common_1.Put)('requirement-settings'),
    (0, require_permission_decorator_1.RequirePermission)('feed.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_requirement_settings_dto_1.UpdateRequirementSettingsDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "updateRequirementSettings", null);
__decorate([
    (0, common_1.Delete)('requirement-settings'),
    (0, require_permission_decorator_1.RequirePermission)('feed.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "resetRequirementSettings", null);
__decorate([
    (0, common_1.Get)('concentrations'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, concentration_dto_1.ListConcentrationsQueryDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "listConcentrations", null);
__decorate([
    (0, common_1.Post)('concentrations'),
    (0, require_permission_decorator_1.RequirePermission)('feed.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, concentration_dto_1.CreateConcentrationDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "createConcentration", null);
__decorate([
    (0, common_1.Post)('concentrations/normalize'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, concentration_dto_1.NormalizeConcentrationDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "normalize", null);
__decorate([
    (0, common_1.Post)('concentrations/bulk-delete'),
    (0, require_permission_decorator_1.RequirePermission)('feed.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, concentration_dto_1.BulkDeleteConcentrationDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "bulkDeleteConcentrations", null);
__decorate([
    (0, common_1.Get)('concentrations/:id'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "getConcentration", null);
__decorate([
    (0, common_1.Patch)('concentrations/:id'),
    (0, require_permission_decorator_1.RequirePermission)('feed.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, concentration_dto_1.UpdateConcentrationDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "updateConcentration", null);
__decorate([
    (0, common_1.Delete)('concentrations/:id'),
    (0, require_permission_decorator_1.RequirePermission)('feed.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "removeConcentration", null);
__decorate([
    (0, common_1.Post)('concentrations/:id/save-version'),
    (0, require_permission_decorator_1.RequirePermission)('feed.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "saveVersion", null);
__decorate([
    (0, common_1.Get)('concentrations/:id/versions'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "listVersions", null);
__decorate([
    (0, common_1.Post)('concentrations/:id/finalize'),
    (0, require_permission_decorator_1.RequirePermission)('feed.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, concentration_dto_1.FinalizeConcentrationDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "finalizeConcentration", null);
__decorate([
    (0, common_1.Get)('concentrations/:id/inventory-check'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "concentrationInventoryCheck", null);
__decorate([
    (0, common_1.Get)('cattle/:cattleId/resolved-ration'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('cattleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FeedController.prototype, "resolvedRation", null);
__decorate([
    (0, common_1.Get)('cattle/:cattleId/program'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('cattleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "programForCattle", null);
__decorate([
    (0, common_1.Get)('cattle/:cattleId/dmi'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('cattleId')),
    __param(2, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "dmiComparison", null);
__decorate([
    (0, common_1.Get)('distributions'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_distribution_query_dto_1.ListDistributionQueryDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "listDistributions", null);
__decorate([
    (0, common_1.Post)('distributions'),
    (0, require_permission_decorator_1.RequirePermission)('feed.distribution-log'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, log_distribution_dto_1.LogDistributionDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "logDistribution", null);
__decorate([
    (0, common_1.Get)('grid'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, feed_grid_query_dto_1.FeedGridQueryDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "getFeedingGrid", null);
__decorate([
    (0, common_1.Get)('grid/calendar'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, feed_grid_calendar_query_dto_1.FeedGridCalendarQueryDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "getFeedingGridCalendar", null);
__decorate([
    (0, common_1.Post)('grid/draft'),
    (0, require_permission_decorator_1.RequirePermission)('feed.distribution-log'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, save_feed_draft_dto_1.SaveFeedDraftDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "saveFeedDraft", null);
__decorate([
    (0, common_1.Post)('grid/confirm'),
    (0, require_permission_decorator_1.RequirePermission)('feed.distribution-log'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, confirm_feed_draft_dto_1.ConfirmFeedDraftDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "confirmFeedDraft", null);
__decorate([
    (0, common_1.Get)('grid/cattle/:cattleId/history'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('cattleId')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, feed_cattle_history_query_dto_1.FeedCattleHistoryQueryDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "getCattleHistory", null);
__decorate([
    (0, common_1.Post)('grid/distributions/:distributionId/cattle/:cattleItemId/void'),
    (0, require_permission_decorator_1.RequirePermission)('feed.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('distributionId')),
    __param(3, (0, common_1.Param)('cattleItemId')),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, void_feed_cattle_item_dto_1.VoidFeedCattleItemDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "voidCattleItem", null);
__decorate([
    (0, common_1.Get)('cost-summary'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "costSummary", null);
__decorate([
    (0, common_1.Get)('efficiency'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_distribution_query_dto_1.FeedEfficiencyQueryDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "efficiency", null);
__decorate([
    (0, common_1.Get)('distributions/:id'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "getDistribution", null);
__decorate([
    (0, common_1.Patch)('distributions/:id/refusal'),
    (0, require_permission_decorator_1.RequirePermission)('feed.distribution-log'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, patch_refusal_dto_1.PatchRefusalDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "patchRefusal", null);
__decorate([
    (0, common_1.Get)('stock'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_feed_stock_query_dto_1.ListFeedStockQueryDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "listStock", null);
__decorate([
    (0, common_1.Post)('stock/bulk-delete'),
    (0, require_permission_decorator_1.RequirePermission)('feed.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, bulk_delete_stock_dto_1.BulkDeleteStockDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "bulkDeleteStock", null);
__decorate([
    (0, common_1.Get)('stock/:id'),
    (0, require_permission_decorator_1.RequirePermission)('feed.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "getStock", null);
__decorate([
    (0, common_1.Delete)('stock/:id'),
    (0, require_permission_decorator_1.RequirePermission)('feed.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "archiveStock", null);
__decorate([
    (0, common_1.Patch)('stock/:id/nutrition'),
    (0, require_permission_decorator_1.RequirePermission)('feed.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, update_stock_nutrition_dto_1.UpdateStockNutritionDto]),
    __metadata("design:returntype", void 0)
], FeedController.prototype, "updateStockNutrition", null);
exports.FeedController = FeedController = __decorate([
    (0, swagger_1.ApiTags)('Feed'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('feed'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard, subscription_feature_guard_1.SubscriptionFeatureGuard),
    (0, require_feature_decorator_1.RequireFeature)('feed.formulator'),
    __metadata("design:paramtypes", [feed_ingredient_service_1.FeedIngredientService,
        feed_requirements_service_1.FeedRequirementsService,
        requirement_settings_service_1.RequirementSettingsService,
        feed_concentration_service_1.FeedConcentrationService,
        feed_distribution_service_1.FeedDistributionService,
        feed_stock_service_1.FeedStockService,
        feed_ration_resolver_service_1.FeedRationResolverService,
        feed_feeding_grid_service_1.FeedFeedingGridService,
        feed_plan_service_1.FeedPlanService])
], FeedController);
//# sourceMappingURL=feed.controller.js.map