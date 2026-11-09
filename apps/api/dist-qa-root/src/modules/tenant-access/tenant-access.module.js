"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantAccessModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const tenant_access_service_1 = require("./application/services/tenant-access.service");
const farm_membership_guard_1 = require("./presentation/guards/farm-membership.guard");
const farm_context_guard_1 = require("./presentation/guards/farm-context.guard");
let TenantAccessModule = class TenantAccessModule {
};
exports.TenantAccessModule = TenantAccessModule;
exports.TenantAccessModule = TenantAccessModule = __decorate([
    (0, common_1.Module)({
        imports: [logger_module_1.LoggerModule],
        providers: [tenant_access_service_1.TenantAccessService, farm_membership_guard_1.FarmMembershipGuard, farm_context_guard_1.FarmContextGuard],
        exports: [tenant_access_service_1.TenantAccessService, farm_membership_guard_1.FarmMembershipGuard, farm_context_guard_1.FarmContextGuard],
    })
], TenantAccessModule);
//# sourceMappingURL=tenant-access.module.js.map