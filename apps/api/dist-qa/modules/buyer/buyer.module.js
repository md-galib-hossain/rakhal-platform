"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuyerModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const permission_module_1 = require("../permission/permission.module");
const inventory_module_1 = require("../inventory/inventory.module");
const subscription_module_1 = require("../subscription/subscription.module");
const sales_module_1 = require("../sales/sales.module");
const activity_module_1 = require("../activity/activity.module");
const buyer_service_1 = require("./application/services/buyer.service");
const buyer_controller_1 = require("./presentation/controllers/buyer.controller");
const milk_dispatch_controller_1 = require("./presentation/controllers/milk-dispatch.controller");
const dispatch_number_allocator_1 = require("./infrastructure/dispatch-number.allocator");
let BuyerModule = class BuyerModule {
};
exports.BuyerModule = BuyerModule;
exports.BuyerModule = BuyerModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            logger_module_1.LoggerModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            inventory_module_1.InventoryModule,
            subscription_module_1.SubscriptionModule,
            sales_module_1.SalesModule,
            activity_module_1.ActivityModule,
        ],
        controllers: [buyer_controller_1.BuyerController, milk_dispatch_controller_1.MilkDispatchController],
        providers: [buyer_service_1.BuyerService, dispatch_number_allocator_1.DispatchNumberAllocator],
        exports: [buyer_service_1.BuyerService],
    })
], BuyerModule);
//# sourceMappingURL=buyer.module.js.map