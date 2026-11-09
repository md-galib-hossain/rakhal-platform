"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminSystemController = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const swagger_1 = require("@nestjs/swagger");
const admin_ip_allowlist_guard_1 = require("../guards/admin-ip-allowlist.guard");
const platform_admin_guard_1 = require("../guards/platform-admin.guard");
const admin_permission_guard_1 = require("../guards/admin-permission.guard");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
let AdminSystemController = class AdminSystemController {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    list() {
        const jobs = this.registry.getCronJobs();
        return {
            crons: Array.from(jobs.entries()).map(([name, job]) => ({
                name,
                running: job.isActive,
                next_run: job.isActive ? job.nextDate().toISO() : null,
                last_run: job.lastDate()?.toISOString() ?? null,
            })),
        };
    }
};
exports.AdminSystemController = AdminSystemController;
__decorate([
    (0, common_1.Get)(),
    (0, require_admin_permission_decorator_1.RequireAdminPermission)('system.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminSystemController.prototype, "list", null);
exports.AdminSystemController = AdminSystemController = __decorate([
    (0, swagger_1.ApiTags)('Admin — System'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin/crons'),
    (0, common_1.UseGuards)(admin_ip_allowlist_guard_1.AdminIpAllowlistGuard, platform_admin_guard_1.PlatformAdminGuard, admin_permission_guard_1.AdminPermissionGuard),
    __metadata("design:paramtypes", [schedule_1.SchedulerRegistry])
], AdminSystemController);
//# sourceMappingURL=admin-system.controller.js.map