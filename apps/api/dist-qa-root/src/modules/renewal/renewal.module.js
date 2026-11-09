"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenewalModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const notification_module_1 = require("../notification/notification.module");
const email_module_1 = require("../email/email.module");
const renewal_reminder_service_1 = require("./application/services/renewal-reminder.service");
let RenewalModule = class RenewalModule {
};
exports.RenewalModule = RenewalModule;
exports.RenewalModule = RenewalModule = __decorate([
    (0, common_1.Module)({
        imports: [logger_module_1.LoggerModule, notification_module_1.NotificationModule, email_module_1.EmailModule],
        providers: [renewal_reminder_service_1.RenewalReminderService],
        exports: [renewal_reminder_service_1.RenewalReminderService],
    })
], RenewalModule);
//# sourceMappingURL=renewal.module.js.map