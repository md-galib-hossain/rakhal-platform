"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const audit_module_1 = require("../audit/audit.module");
const subscription_module_1 = require("../subscription/subscription.module");
const media_module_1 = require("../media/media.module");
const admin_module_1 = require("../admin/admin.module");
const feedback_service_1 = require("./application/services/feedback.service");
const trial_abuse_service_1 = require("./application/services/trial-abuse.service");
const feedback_controller_1 = require("./presentation/controllers/feedback.controller");
const admin_feedback_controller_1 = require("./presentation/controllers/admin-feedback.controller");
let SupportModule = class SupportModule {
};
exports.SupportModule = SupportModule;
exports.SupportModule = SupportModule = __decorate([
    (0, common_1.Module)({
        imports: [
            logger_module_1.LoggerModule,
            auth_module_1.AuthModule,
            tenant_access_module_1.TenantAccessModule,
            audit_module_1.AuditModule,
            subscription_module_1.SubscriptionModule,
            media_module_1.MediaModule,
            admin_module_1.AdminModule,
        ],
        controllers: [feedback_controller_1.FeedbackController, admin_feedback_controller_1.AdminFeedbackController],
        providers: [feedback_service_1.FeedbackService, trial_abuse_service_1.TrialAbuseService],
        exports: [trial_abuse_service_1.TrialAbuseService],
    })
], SupportModule);
//# sourceMappingURL=support.module.js.map