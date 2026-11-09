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
exports.ReproductionController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const reproduction_service_1 = require("../../application/services/reproduction.service");
const common_dto_1 = require("../dto/common.dto");
const list_pregnancies_query_dto_1 = require("../dto/list-pregnancies-query.dto");
const list_reproduction_cows_query_dto_1 = require("../dto/list-reproduction-cows-query.dto");
const swagger_1 = require("@nestjs/swagger");
let ReproductionController = class ReproductionController {
    reproductionService;
    constructor(reproductionService) {
        this.reproductionService = reproductionService;
    }
    listHeatEvents(farmId, query) {
        return this.reproductionService.listHeatEvents(farmId, query);
    }
    listBreedingEvents(farmId, query) {
        return this.reproductionService.listBreedingEvents(farmId, query);
    }
    getBreedingEvent(farmId, id) {
        return this.reproductionService.getBreedingEvent(farmId, id);
    }
    listPregnancies(farmId, query) {
        return this.reproductionService.listPregnancies(farmId, query);
    }
    listCalvingEvents(farmId, query) {
        return this.reproductionService.listCalvingEvents(farmId, query);
    }
    listAbortionEvents(farmId, query) {
        return this.reproductionService.listAbortionEvents(farmId, query);
    }
    listLactations(farmId, query) {
        return this.reproductionService.listLactations(farmId, query);
    }
    dashboard(farmId) {
        return this.reproductionService.dashboard(farmId);
    }
    listReproductionCows(farmId, query) {
        return this.reproductionService.listReproductionCows(farmId, query);
    }
};
exports.ReproductionController = ReproductionController;
__decorate([
    (0, common_1.Get)('heat-events'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, common_dto_1.ReproductionListQueryDto]),
    __metadata("design:returntype", void 0)
], ReproductionController.prototype, "listHeatEvents", null);
__decorate([
    (0, common_1.Get)('breeding-events'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, common_dto_1.ReproductionListQueryDto]),
    __metadata("design:returntype", void 0)
], ReproductionController.prototype, "listBreedingEvents", null);
__decorate([
    (0, common_1.Get)('breeding-events/:id'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ReproductionController.prototype, "getBreedingEvent", null);
__decorate([
    (0, common_1.Get)('pregnancies'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_pregnancies_query_dto_1.ListPregnanciesQueryDto]),
    __metadata("design:returntype", void 0)
], ReproductionController.prototype, "listPregnancies", null);
__decorate([
    (0, common_1.Get)('calving-events'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, common_dto_1.ReproductionListQueryDto]),
    __metadata("design:returntype", void 0)
], ReproductionController.prototype, "listCalvingEvents", null);
__decorate([
    (0, common_1.Get)('abortion-events'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, common_dto_1.ReproductionListQueryDto]),
    __metadata("design:returntype", void 0)
], ReproductionController.prototype, "listAbortionEvents", null);
__decorate([
    (0, common_1.Get)('lactations'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, common_dto_1.ReproductionListQueryDto]),
    __metadata("design:returntype", void 0)
], ReproductionController.prototype, "listLactations", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReproductionController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('cows'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_reproduction_cows_query_dto_1.ListReproductionCowsQueryDto]),
    __metadata("design:returntype", void 0)
], ReproductionController.prototype, "listReproductionCows", null);
exports.ReproductionController = ReproductionController = __decorate([
    (0, swagger_1.ApiTags)('Reproduction'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('reproduction'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [reproduction_service_1.ReproductionService])
], ReproductionController);
//# sourceMappingURL=reproduction.controller.js.map