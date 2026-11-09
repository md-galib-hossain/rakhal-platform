"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalfModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const permission_module_1 = require("../permission/permission.module");
const task_module_1 = require("../task/task.module");
const subscription_module_1 = require("../subscription/subscription.module");
const animal_events_module_1 = require("../animal-events/animal-events.module");
const calf_events_handler_1 = require("./application/events/calf-events.handler");
const calf_service_1 = require("./application/services/calf.service");
const calf_controller_1 = require("./presentation/controllers/calf.controller");
let CalfModule = class CalfModule {
};
exports.CalfModule = CalfModule;
exports.CalfModule = CalfModule = __decorate([
    (0, common_1.Module)({
        imports: [
            animal_events_module_1.AnimalEventsModule,
            auth_module_1.AuthModule,
            logger_module_1.LoggerModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            task_module_1.TaskModule,
            subscription_module_1.SubscriptionModule,
        ],
        controllers: [calf_controller_1.CalfController],
        providers: [calf_service_1.CalfService, calf_events_handler_1.CalfEventHandler],
        exports: [calf_service_1.CalfService],
    })
], CalfModule);
//# sourceMappingURL=calf.module.js.map