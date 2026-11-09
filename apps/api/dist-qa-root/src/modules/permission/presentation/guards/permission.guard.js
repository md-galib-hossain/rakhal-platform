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
exports.PermissionGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const permission_service_1 = require("../../application/services/permission.service");
const require_permission_decorator_1 = require("../decorators/require-permission.decorator");
let PermissionGuard = class PermissionGuard {
    reflector;
    permissionService;
    constructor(reflector, permissionService) {
        this.reflector = reflector;
        this.permissionService = permissionService;
    }
    async canActivate(context) {
        const requiredPermissions = this.reflector.getAllAndOverride(require_permission_decorator_1.REQUIRED_PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]) ?? [];
        if (requiredPermissions.length === 0) {
            return true;
        }
        const request = context
            .switchToHttp()
            .getRequest();
        if (!request.auth || !request.farm) {
            throw new common_1.ForbiddenException('Permission denied');
        }
        await this.permissionService.assertPermissions(request.auth.user.sub, request.farm.farmId, request.auth.user.permissionsVersion, requiredPermissions);
        return true;
    }
};
exports.PermissionGuard = PermissionGuard;
exports.PermissionGuard = PermissionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        permission_service_1.PermissionService])
], PermissionGuard);
//# sourceMappingURL=permission.guard.js.map