"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const env_1 = require("src/core/config/env");
const prisma_module_1 = require("src/core/database/prisma/prisma.module");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const permission_module_1 = require("../permission/permission.module");
const audit_module_1 = require("../audit/audit.module");
const subscription_module_1 = require("../subscription/subscription.module");
const email_module_1 = require("../email/email.module");
const activity_module_1 = require("../activity/activity.module");
const settings_service_1 = require("./application/services/settings.service");
const roles_service_1 = require("./application/services/roles.service");
const team_service_1 = require("./application/services/team.service");
const workspace_settings_service_1 = require("./application/services/workspace-settings.service");
const settings_controller_1 = require("./presentation/controllers/settings.controller");
const roles_controller_1 = require("./presentation/controllers/roles.controller");
const team_controller_1 = require("./presentation/controllers/team.controller");
const workspace_settings_controller_1 = require("./presentation/controllers/workspace-settings.controller");
let SettingsModule = class SettingsModule {
};
exports.SettingsModule = SettingsModule;
exports.SettingsModule = SettingsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            logger_module_1.LoggerModule,
            auth_module_1.AuthModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            audit_module_1.AuditModule,
            subscription_module_1.SubscriptionModule,
            email_module_1.EmailModule,
            activity_module_1.ActivityModule,
            config_1.ConfigModule.forFeature(env_1.emailConfig),
        ],
        controllers: [
            settings_controller_1.SettingsController,
            roles_controller_1.RolesController,
            team_controller_1.TeamController,
            workspace_settings_controller_1.WorkspaceSettingsController,
        ],
        providers: [
            settings_service_1.SettingsService,
            roles_service_1.RolesService,
            team_service_1.TeamService,
            workspace_settings_service_1.WorkspaceSettingsService,
        ],
        exports: [
            settings_service_1.SettingsService,
            roles_service_1.RolesService,
            team_service_1.TeamService,
            workspace_settings_service_1.WorkspaceSettingsService,
        ],
    })
], SettingsModule);
//# sourceMappingURL=settings.module.js.map