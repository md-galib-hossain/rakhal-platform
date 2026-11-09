"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const billing_module_1 = require("../billing/billing.module");
const subscription_module_1 = require("../subscription/subscription.module");
const feed_module_1 = require("../feed/feed.module");
const notification_module_1 = require("../notification/notification.module");
const admin_communications_controller_1 = require("./presentation/controllers/admin-communications.controller");
const admin_communications_service_1 = require("./application/services/admin-communications.service");
const admin_token_service_1 = require("./application/services/admin-token.service");
const admin_auth_service_1 = require("./application/services/admin-auth.service");
const admin_audit_service_1 = require("./application/services/admin-audit.service");
const admin_totp_service_1 = require("./application/services/admin-totp.service");
const platform_admin_guard_1 = require("./presentation/guards/platform-admin.guard");
const admin_permission_guard_1 = require("./presentation/guards/admin-permission.guard");
const admin_two_factor_setup_guard_1 = require("./presentation/guards/admin-two-factor-setup.guard");
const admin_ip_allowlist_guard_1 = require("./presentation/guards/admin-ip-allowlist.guard");
const admin_session_service_1 = require("./application/services/admin-session.service");
const admin_management_service_1 = require("./application/services/admin-management.service");
const admin_admins_controller_1 = require("./presentation/controllers/admin-admins.controller");
const admin_directory_controller_1 = require("./presentation/controllers/admin-directory.controller");
const admin_support_actions_controller_1 = require("./presentation/controllers/admin-support-actions.controller");
const admin_ops_controller_1 = require("./presentation/controllers/admin-ops.controller");
const admin_subscriptions_controller_1 = require("./presentation/controllers/admin-subscriptions.controller");
const admin_analytics_controller_1 = require("./presentation/controllers/admin-analytics.controller");
const admin_subscriptions_service_1 = require("./application/services/admin-subscriptions.service");
const admin_analytics_service_1 = require("./application/services/admin-analytics.service");
const admin_config_controller_1 = require("./presentation/controllers/admin-config.controller");
const admin_ops_service_1 = require("./application/services/admin-ops.service");
const admin_platform_config_service_1 = require("./application/services/admin-platform-config.service");
const bullmq_1 = require("@nestjs/bullmq");
const outbox_queue_constants_1 = require("src/common/outbox/infrastructure/queue/outbox.queue.constants");
const email_queue_constants_1 = require("src/modules/email/infrastructure/queue/email.queue.constants");
const schedule_queue_port_1 = require("src/modules/notification/application/queue/schedule-queue.port");
const admin_support_actions_service_1 = require("./application/services/admin-support-actions.service");
const admin_directory_service_1 = require("./application/services/admin-directory.service");
const admin_auth_controller_1 = require("./presentation/controllers/admin-auth.controller");
const admin_billing_controller_1 = require("./presentation/controllers/admin-billing.controller");
const admin_reconciliation_controller_1 = require("./presentation/controllers/admin-reconciliation.controller");
const admin_audit_controller_1 = require("./presentation/controllers/admin-audit.controller");
const admin_health_controller_1 = require("./presentation/controllers/admin-health.controller");
const admin_feed_ingredient_controller_1 = require("./presentation/controllers/admin-feed-ingredient.controller");
const admin_requirement_preset_controller_1 = require("./presentation/controllers/admin-requirement-preset.controller");
const admin_system_controller_1 = require("./presentation/controllers/admin-system.controller");
const admin_insights_controller_1 = require("./presentation/controllers/admin-insights.controller");
const admin_insights_service_1 = require("./application/services/admin-insights.service");
let AdminModule = class AdminModule {
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({
        imports: [
            logger_module_1.LoggerModule,
            auth_module_1.AuthModule,
            billing_module_1.BillingModule,
            subscription_module_1.SubscriptionModule,
            feed_module_1.FeedModule,
            notification_module_1.NotificationModule,
            bullmq_1.BullModule.registerQueue({ name: outbox_queue_constants_1.OUTBOX_QUEUE }, { name: email_queue_constants_1.EMAIL_QUEUE }, { name: schedule_queue_port_1.NOTIFICATION_OCCURRENCE_QUEUE }),
        ],
        controllers: [
            admin_auth_controller_1.AdminAuthController,
            admin_billing_controller_1.AdminBillingController,
            admin_reconciliation_controller_1.AdminReconciliationController,
            admin_audit_controller_1.AdminAuditController,
            admin_health_controller_1.AdminHealthController,
            admin_feed_ingredient_controller_1.AdminFeedIngredientController,
            admin_requirement_preset_controller_1.AdminRequirementPresetController,
            admin_system_controller_1.AdminSystemController,
            admin_admins_controller_1.AdminAdminsController,
            admin_directory_controller_1.AdminDirectoryController,
            admin_support_actions_controller_1.AdminSupportActionsController,
            admin_ops_controller_1.AdminOpsController,
            admin_subscriptions_controller_1.AdminSubscriptionsController,
            admin_analytics_controller_1.AdminAnalyticsController,
            admin_insights_controller_1.AdminInsightsController,
            admin_config_controller_1.AdminConfigController,
            admin_communications_controller_1.AdminCommunicationsController,
        ],
        providers: [
            admin_token_service_1.AdminTokenService,
            admin_session_service_1.AdminSessionService,
            admin_communications_service_1.AdminCommunicationsService,
            admin_management_service_1.AdminManagementService,
            admin_directory_service_1.AdminDirectoryService,
            admin_support_actions_service_1.AdminSupportActionsService,
            admin_ops_service_1.AdminOpsService,
            admin_subscriptions_service_1.AdminSubscriptionsService,
            admin_analytics_service_1.AdminAnalyticsService,
            admin_insights_service_1.AdminInsightsService,
            admin_platform_config_service_1.AdminPlatformConfigService,
            admin_auth_service_1.AdminAuthService,
            admin_audit_service_1.AdminAuditService,
            admin_totp_service_1.AdminTotpService,
            platform_admin_guard_1.PlatformAdminGuard,
            admin_permission_guard_1.AdminPermissionGuard,
            admin_two_factor_setup_guard_1.AdminTwoFactorSetupGuard,
            admin_ip_allowlist_guard_1.AdminIpAllowlistGuard,
        ],
        exports: [
            platform_admin_guard_1.PlatformAdminGuard,
            admin_token_service_1.AdminTokenService,
            admin_audit_service_1.AdminAuditService,
            admin_session_service_1.AdminSessionService,
            admin_platform_config_service_1.AdminPlatformConfigService,
        ],
    })
], AdminModule);
//# sourceMappingURL=admin.module.js.map