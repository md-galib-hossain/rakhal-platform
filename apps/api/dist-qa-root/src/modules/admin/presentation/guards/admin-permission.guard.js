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
exports.AdminPermissionGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const admin_permission_matrix_1 = require("../../domain/admin-permission-matrix");
const require_admin_permission_decorator_1 = require("../decorators/require-admin-permission.decorator");
let AdminPermissionGuard = class AdminPermissionGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const required = this.reflector.getAllAndOverride(require_admin_permission_decorator_1.ADMIN_PERMISSION_KEY, [context.getHandler(), context.getClass()]);
        const request = context
            .switchToHttp()
            .getRequest();
        if (!request.admin) {
            throw new common_1.ForbiddenException('Admin authentication required');
        }
        if (request.admin.mustChangePassword) {
            throw new common_1.ForbiddenException('PASSWORD_CHANGE_REQUIRED');
        }
        if (!required) {
            const authenticatedOnly = this.reflector.getAllAndOverride(require_admin_permission_decorator_1.ADMIN_AUTHENTICATED_ONLY_KEY, [
                context.getHandler(),
                context.getClass(),
            ]);
            if (authenticatedOnly)
                return true;
            throw new common_1.ForbiddenException('Admin route has no permission requirement declared');
        }
        if (!(0, admin_permission_matrix_1.adminRoleHasPermission)(request.admin.role, required)) {
            throw new common_1.ForbiddenException(`Admin role ${request.admin.role} lacks permission ${required}`);
        }
        return true;
    }
};
exports.AdminPermissionGuard = AdminPermissionGuard;
exports.AdminPermissionGuard = AdminPermissionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], AdminPermissionGuard);
//# sourceMappingURL=admin-permission.guard.js.map