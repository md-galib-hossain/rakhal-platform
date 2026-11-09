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
exports.FarmMembershipGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const farm_context_decorator_1 = require("../decorators/farm-context.decorator");
const tenant_access_service_1 = require("../../application/services/tenant-access.service");
let FarmMembershipGuard = class FarmMembershipGuard {
    reflector;
    tenantAccessService;
    constructor(reflector, tenantAccessService) {
        this.reflector = reflector;
        this.tenantAccessService = tenantAccessService;
    }
    async canActivate(context) {
        const request = context
            .switchToHttp()
            .getRequest();
        const userId = request.user?.sub;
        const farmParamKey = this.reflector.get(farm_context_decorator_1.FARM_PARAM_KEY, context.getHandler()) ??
            'farmId';
        const farmId = request.params?.[farmParamKey];
        if (!userId || typeof farmId !== 'string' || farmId.length === 0) {
            throw new common_1.ForbiddenException('Farm access denied');
        }
        request.farm = await this.tenantAccessService.resolveFarmContext(userId, farmId);
        return true;
    }
};
exports.FarmMembershipGuard = FarmMembershipGuard;
exports.FarmMembershipGuard = FarmMembershipGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        tenant_access_service_1.TenantAccessService])
], FarmMembershipGuard);
//# sourceMappingURL=farm-membership.guard.js.map