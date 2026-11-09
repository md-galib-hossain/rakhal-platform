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
exports.AnimalHoldController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const animal_hold_service_1 = require("../../application/services/animal-hold.service");
const create_animal_hold_dto_1 = require("../dto/create-animal-hold.dto");
const list_animal_hold_query_dto_1 = require("../dto/list-animal-hold-query.dto");
const release_animal_hold_dto_1 = require("../dto/release-animal-hold.dto");
let AnimalHoldController = class AnimalHoldController {
    animalHoldService;
    constructor(animalHoldService) {
        this.animalHoldService = animalHoldService;
    }
    list(farmId, cattleId, query) {
        return this.animalHoldService.list(farmId, cattleId, query);
    }
    create(farmId, userId, cattleId, dto) {
        return this.animalHoldService.createHold(farmId, userId, cattleId, dto);
    }
    release(farmId, userId, cattleId, holdId, dto) {
        return this.animalHoldService.releaseHold(farmId, cattleId, holdId, userId, dto);
    }
};
exports.AnimalHoldController = AnimalHoldController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('cattle.hold'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('cattleId')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, list_animal_hold_query_dto_1.ListAnimalHoldQueryDto]),
    __metadata("design:returntype", void 0)
], AnimalHoldController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('cattle.hold'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('cattleId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, create_animal_hold_dto_1.CreateAnimalHoldDto]),
    __metadata("design:returntype", void 0)
], AnimalHoldController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':holdId/release'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.hold'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('cattleId')),
    __param(3, (0, common_1.Param)('holdId')),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, release_animal_hold_dto_1.ReleaseAnimalHoldDto]),
    __metadata("design:returntype", void 0)
], AnimalHoldController.prototype, "release", null);
exports.AnimalHoldController = AnimalHoldController = __decorate([
    (0, swagger_1.ApiTags)('Cattle'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('cattle/:cattleId/holds'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [animal_hold_service_1.AnimalHoldService])
], AnimalHoldController);
//# sourceMappingURL=animal-hold.controller.js.map