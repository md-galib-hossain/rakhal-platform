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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShedController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const shed_service_1 = require("../../application/services/shed.service");
const create_shed_dto_1 = require("../dto/create-shed.dto");
const list_shed_query_dto_1 = require("../dto/list-shed-query.dto");
const update_shed_dto_1 = require("../dto/update-shed.dto");
const swagger_1 = require("@nestjs/swagger");
let ShedController = class ShedController {
    shedService;
    constructor(shedService) {
        this.shedService = shedService;
    }
    create(farmId, dto) {
        return this.shedService.create(farmId, dto);
    }
    findAll(farmId, query) {
        return this.shedService.findAll(farmId, query);
    }
    findOne(farmId, id) {
        return this.shedService.findOne(farmId, id);
    }
    update(farmId, id, dto) {
        return this.shedService.update(farmId, id, dto);
    }
    archive(farmId, id) {
        return this.shedService.archive(farmId, id);
    }
    restore(farmId, id) {
        return this.shedService.restore(farmId, id);
    }
    remove(farmId, id) {
        return this.shedService.remove(farmId, id);
    }
};
exports.ShedController = ShedController;
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('cattle.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_shed_dto_1.CreateShedDto]),
    __metadata("design:returntype", void 0)
], ShedController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_shed_query_dto_1.ListShedQueryDto]),
    __metadata("design:returntype", void 0)
], ShedController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ShedController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_shed_dto_1.UpdateShedDto]),
    __metadata("design:returntype", void 0)
], ShedController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/archive'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ShedController.prototype, "archive", null);
__decorate([
    (0, common_1.Patch)(':id/restore'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ShedController.prototype, "restore", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ShedController.prototype, "remove", null);
exports.ShedController = ShedController = __decorate([
    (0, swagger_1.ApiTags)('Sheds'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('sheds'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [shed_service_1.ShedService])
], ShedController);
//# sourceMappingURL=shed.controller.js.map