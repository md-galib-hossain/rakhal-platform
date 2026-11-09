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
exports.AnimalGroupController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const animal_group_service_1 = require("../../application/services/animal-group.service");
const animal_group_members_dto_1 = require("../dto/animal-group-members.dto");
const create_animal_group_dto_1 = require("../dto/create-animal-group.dto");
const list_animal_group_query_dto_1 = require("../dto/list-animal-group-query.dto");
const update_animal_group_dto_1 = require("../dto/update-animal-group.dto");
let AnimalGroupController = class AnimalGroupController {
    groups;
    constructor(groups) {
        this.groups = groups;
    }
    create(farmId, userId, dto) {
        return this.groups.create(farmId, userId, dto);
    }
    findAll(farmId, query) {
        return this.groups.findAll(farmId, query);
    }
    findOne(farmId, id) {
        return this.groups.findOne(farmId, id);
    }
    update(farmId, id, dto) {
        return this.groups.update(farmId, id, dto);
    }
    remove(farmId, id) {
        return this.groups.remove(farmId, id);
    }
    addMembers(farmId, userId, id, dto) {
        return this.groups.addMembers(farmId, userId, id, dto.cattleIds);
    }
    removeMembers(farmId, id, dto) {
        return this.groups.removeMembers(farmId, id, dto.cattleIds);
    }
};
exports.AnimalGroupController = AnimalGroupController;
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('cattle.bulk'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_animal_group_dto_1.CreateAnimalGroupDto]),
    __metadata("design:returntype", void 0)
], AnimalGroupController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_animal_group_query_dto_1.ListAnimalGroupQueryDto]),
    __metadata("design:returntype", void 0)
], AnimalGroupController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AnimalGroupController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.bulk'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_animal_group_dto_1.UpdateAnimalGroupDto]),
    __metadata("design:returntype", void 0)
], AnimalGroupController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.bulk'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AnimalGroupController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/members'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.bulk'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, animal_group_members_dto_1.AnimalGroupMembersDto]),
    __metadata("design:returntype", void 0)
], AnimalGroupController.prototype, "addMembers", null);
__decorate([
    (0, common_1.Delete)(':id/members'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.bulk'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, animal_group_members_dto_1.AnimalGroupMembersDto]),
    __metadata("design:returntype", void 0)
], AnimalGroupController.prototype, "removeMembers", null);
exports.AnimalGroupController = AnimalGroupController = __decorate([
    (0, swagger_1.ApiTags)('Animal Groups'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('animal-groups'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [animal_group_service_1.AnimalGroupService])
], AnimalGroupController);
//# sourceMappingURL=animal-group.controller.js.map