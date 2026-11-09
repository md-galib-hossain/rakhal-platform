"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const permission_module_1 = require("../permission/permission.module");
const subscription_module_1 = require("../subscription/subscription.module");
const milk_module_1 = require("../milk/milk.module");
const inventory_module_1 = require("../inventory/inventory.module");
const finance_v2_accounts_module_1 = require("../finance-v2/accounts/finance-v2-accounts.module");
const farm_settings_module_1 = require("../farm-settings/farm-settings.module");
const feed_concentration_service_1 = require("./application/services/feed-concentration.service");
const feed_ingredient_service_1 = require("./application/services/feed-ingredient.service");
const audit_module_1 = require("src/modules/audit/audit.module");
const feed_requirements_service_1 = require("./application/services/feed-requirements.service");
const feed_lookahead_service_1 = require("./application/services/feed-lookahead.service");
const requirement_settings_service_1 = require("./application/services/requirement-settings.service");
const feed_distribution_service_1 = require("./application/services/feed-distribution.service");
const feed_stock_service_1 = require("./application/services/feed-stock.service");
const feed_ration_resolver_service_1 = require("./application/services/feed-ration-resolver.service");
const feed_feeding_grid_service_1 = require("./application/services/feed-feeding-grid.service");
const nutrition_profile_module_1 = require("./nutrition-profile.module");
const activity_module_1 = require("../activity/activity.module");
const feed_controller_1 = require("./presentation/controllers/feed.controller");
const feed_plan_controller_1 = require("./presentation/controllers/feed-plan.controller");
const feed_plan_service_1 = require("./application/services/feed-plan.service");
const feed_plan_assignment_service_1 = require("./application/services/feed-plan-assignment.service");
const feed_plan_resolver_service_1 = require("./application/services/feed-plan-resolver.service");
const feed_plan_assignment_controller_1 = require("./presentation/controllers/feed-plan-assignment.controller");
const requirement_override_controller_1 = require("./presentation/controllers/requirement-override.controller");
const requirement_override_service_1 = require("./application/services/requirement-override.service");
const task_module_1 = require("../task/task.module");
const feed_plan_fit_sweep_service_1 = require("./application/services/feed-plan-fit-sweep.service");
let FeedModule = class FeedModule {
};
exports.FeedModule = FeedModule;
exports.FeedModule = FeedModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            audit_module_1.AuditModule,
            activity_module_1.ActivityModule,
            nutrition_profile_module_1.NutritionProfileModule,
            logger_module_1.LoggerModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            subscription_module_1.SubscriptionModule,
            milk_module_1.MilkModule,
            inventory_module_1.InventoryModule,
            finance_v2_accounts_module_1.FinanceV2AccountsModule,
            farm_settings_module_1.FarmSettingsModule,
            task_module_1.TaskModule,
        ],
        controllers: [
            feed_controller_1.FeedController,
            feed_plan_controller_1.FeedPlanController,
            feed_plan_assignment_controller_1.FeedPlanAssignmentController,
            requirement_override_controller_1.RequirementOverrideController,
        ],
        providers: [
            feed_ingredient_service_1.FeedIngredientService,
            feed_requirements_service_1.FeedRequirementsService,
            feed_lookahead_service_1.FeedLookaheadService,
            requirement_settings_service_1.RequirementSettingsService,
            feed_concentration_service_1.FeedConcentrationService,
            feed_distribution_service_1.FeedDistributionService,
            feed_stock_service_1.FeedStockService,
            feed_ration_resolver_service_1.FeedRationResolverService,
            feed_feeding_grid_service_1.FeedFeedingGridService,
            feed_plan_service_1.FeedPlanService,
            feed_plan_assignment_service_1.FeedPlanAssignmentService,
            feed_plan_resolver_service_1.FeedPlanResolverService,
            requirement_override_service_1.RequirementOverrideService,
            feed_plan_fit_sweep_service_1.FeedPlanFitSweepService,
        ],
        exports: [
            feed_ingredient_service_1.FeedIngredientService,
            requirement_settings_service_1.RequirementSettingsService,
            feed_concentration_service_1.FeedConcentrationService,
            feed_distribution_service_1.FeedDistributionService,
            feed_plan_fit_sweep_service_1.FeedPlanFitSweepService,
        ],
    })
], FeedModule);
//# sourceMappingURL=feed.module.js.map