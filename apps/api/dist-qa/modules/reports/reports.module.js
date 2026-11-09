"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsModule = void 0;
const common_1 = require("@nestjs/common");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const auth_module_1 = require("../auth/auth.module");
const audit_module_1 = require("../audit/audit.module");
const media_module_1 = require("../media/media.module");
const permission_module_1 = require("../permission/permission.module");
const subscription_module_1 = require("../subscription/subscription.module");
const tenant_access_module_1 = require("../tenant-access/tenant-access.module");
const reports_api_service_1 = require("./application/api/reports-api.service");
const reports_api_types_1 = require("./application/api/reports-api.types");
const pipeline_1 = require("./application/pipeline");
const reports_controller_1 = require("./presentation/controllers/reports.controller");
const reports_pipeline_providers_1 = require("./reports-pipeline.providers");
let ReportsModule = class ReportsModule {
};
exports.ReportsModule = ReportsModule;
exports.ReportsModule = ReportsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            logger_module_1.LoggerModule,
            auth_module_1.AuthModule,
            audit_module_1.AuditModule,
            media_module_1.MediaModule,
            permission_module_1.PermissionModule,
            subscription_module_1.SubscriptionModule,
            tenant_access_module_1.TenantAccessModule,
            ...reports_pipeline_providers_1.REPORT_PIPELINE_IMPORTS,
        ],
        controllers: [reports_controller_1.ReportsController],
        providers: [
            reports_api_service_1.ReportsApiService,
            { provide: reports_api_types_1.REPORT_LIFECYCLE, useExisting: pipeline_1.ReportLifecycleService },
            ...reports_pipeline_providers_1.REPORT_PIPELINE_PROVIDERS,
        ],
    })
], ReportsModule);
//# sourceMappingURL=reports.module.js.map