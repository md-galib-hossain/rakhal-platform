"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const permission_module_1 = require("../permission/permission.module");
const notification_module_1 = require("../notification/notification.module");
const activity_module_1 = require("../activity/activity.module");
const subscription_module_1 = require("../subscription/subscription.module");
const media_module_1 = require("../media/media.module");
const medicine_service_1 = require("./application/services/medicine.service");
const feed_item_service_1 = require("./application/services/feed-item.service");
const semen_service_1 = require("./application/services/semen.service");
const milk_tank_service_1 = require("./application/services/milk-tank.service");
const equipment_service_1 = require("./application/services/equipment.service");
const unit_service_1 = require("./application/services/unit.service");
const inventory_activity_service_1 = require("./application/services/inventory-activity.service");
const nutrition_profile_module_1 = require("../feed/nutrition-profile.module");
const medicine_controller_1 = require("./presentation/controllers/medicine.controller");
const feed_item_controller_1 = require("./presentation/controllers/feed-item.controller");
const semen_controller_1 = require("./presentation/controllers/semen.controller");
const milk_tank_controller_1 = require("./presentation/controllers/milk-tank.controller");
const equipment_controller_1 = require("./presentation/controllers/equipment.controller");
const unit_controller_1 = require("./presentation/controllers/unit.controller");
let InventoryModule = class InventoryModule {
};
exports.InventoryModule = InventoryModule;
exports.InventoryModule = InventoryModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            logger_module_1.LoggerModule,
            notification_module_1.NotificationModule,
            subscription_module_1.SubscriptionModule,
            media_module_1.MediaModule,
            activity_module_1.ActivityModule,
            nutrition_profile_module_1.NutritionProfileModule,
        ],
        controllers: [
            medicine_controller_1.MedicineController,
            feed_item_controller_1.FeedItemController,
            semen_controller_1.SemenController,
            milk_tank_controller_1.MilkTankController,
            equipment_controller_1.EquipmentController,
            unit_controller_1.UnitController,
        ],
        providers: [
            medicine_service_1.MedicineService,
            feed_item_service_1.FeedItemService,
            semen_service_1.SemenService,
            milk_tank_service_1.MilkTankService,
            equipment_service_1.EquipmentService,
            unit_service_1.UnitService,
            inventory_activity_service_1.InventoryActivityService,
        ],
        exports: [
            medicine_service_1.MedicineService,
            feed_item_service_1.FeedItemService,
            semen_service_1.SemenService,
            milk_tank_service_1.MilkTankService,
            equipment_service_1.EquipmentService,
            unit_service_1.UnitService,
        ],
    })
], InventoryModule);
//# sourceMappingURL=inventory.module.js.map