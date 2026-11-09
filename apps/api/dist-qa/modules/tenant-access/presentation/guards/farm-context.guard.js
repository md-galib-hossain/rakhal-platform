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
exports.FarmContextGuard = void 0;
const common_1 = require("@nestjs/common");
const tenant_access_service_1 = require("../../application/services/tenant-access.service");
let FarmContextGuard = class FarmContextGuard {
    tenantAccessService;
    constructor(tenantAccessService) {
        this.tenantAccessService = tenantAccessService;
    }
    async canActivate(context) {
        const request = context
            .switchToHttp()
            .getRequest();
        const userId = request.auth?.user.sub;
        const farmId = request.auth?.user.farmId;
        if (!userId || typeof farmId !== 'string' || farmId.length === 0) {
            throw new common_1.ForbiddenException('Farm access denied');
        }
        request.farm = await this.tenantAccessService.resolveFarmContext(userId, farmId);
        return true;
    }
};
exports.FarmContextGuard = FarmContextGuard;
exports.FarmContextGuard = FarmContextGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_access_service_1.TenantAccessService])
], FarmContextGuard);
//# sourceMappingURL=farm-context.guard.js.map