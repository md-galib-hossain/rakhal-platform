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
exports.ReproProtocolController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const repro_protocol_service_1 = require("../../application/services/repro-protocol.service");
const protocol_dto_1 = require("../dto/protocol.dto");
const swagger_1 = require("@nestjs/swagger");
let ReproProtocolController = class ReproProtocolController {
    protocols;
    constructor(protocols) {
        this.protocols = protocols;
    }
    list(farmId, query) {
        return this.protocols.listProtocols(farmId, query);
    }
    create(farmId, userId, dto) {
        return this.protocols.createProtocol(farmId, userId, dto);
    }
    kpis(farmId) {
        return this.protocols.kpis(farmId);
    }
    listInstances(farmId, query) {
        return this.protocols.listInstances(farmId, query);
    }
    getInstance(farmId, id) {
        return this.protocols.getInstance(farmId, id);
    }
    apply(farmId, userId, dto) {
        return this.protocols.apply(farmId, userId, dto);
    }
    recordAi(farmId, userId, id, dto) {
        return this.protocols.recordAi(farmId, userId, id, dto);
    }
    recordOutcome(farmId, userId, id, dto) {
        return this.protocols.recordOutcome(farmId, userId, id, dto);
    }
    closeInstance(farmId, userId, id, dto) {
        return this.protocols.closeInstance(farmId, userId, id, dto);
    }
    getProtocol(farmId, id) {
        return this.protocols.getProtocol(farmId, id);
    }
    update(farmId, id, dto) {
        return this.protocols.updateProtocol(farmId, id, dto);
    }
    remove(farmId, id) {
        return this.protocols.deleteProtocol(farmId, id);
    }
};
exports.ReproProtocolController = ReproProtocolController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, protocol_dto_1.ListProtocolQueryDto]),
    __metadata("design:returntype", void 0)
], ReproProtocolController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, protocol_dto_1.CreateProtocolDto]),
    __metadata("design:returntype", void 0)
], ReproProtocolController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('kpis'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReproProtocolController.prototype, "kpis", null);
__decorate([
    (0, common_1.Get)('instances'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, protocol_dto_1.ListInstanceQueryDto]),
    __metadata("design:returntype", void 0)
], ReproProtocolController.prototype, "listInstances", null);
__decorate([
    (0, common_1.Get)('instances/:id'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ReproProtocolController.prototype, "getInstance", null);
__decorate([
    (0, common_1.Post)('apply'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.create'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, protocol_dto_1.ApplyProtocolDto]),
    __metadata("design:returntype", void 0)
], ReproProtocolController.prototype, "apply", null);
__decorate([
    (0, common_1.Post)('instances/:id/ai'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, protocol_dto_1.RecordAiDto]),
    __metadata("design:returntype", void 0)
], ReproProtocolController.prototype, "recordAi", null);
__decorate([
    (0, common_1.Post)('instances/:id/outcome'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, protocol_dto_1.RecordOutcomeDto]),
    __metadata("design:returntype", void 0)
], ReproProtocolController.prototype, "recordOutcome", null);
__decorate([
    (0, common_1.Post)('instances/:id/close'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, protocol_dto_1.CloseInstanceDto]),
    __metadata("design:returntype", void 0)
], ReproProtocolController.prototype, "closeInstance", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ReproProtocolController.prototype, "getProtocol", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, protocol_dto_1.UpdateProtocolDto]),
    __metadata("design:returntype", void 0)
], ReproProtocolController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('reproduction.delete'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ReproProtocolController.prototype, "remove", null);
exports.ReproProtocolController = ReproProtocolController = __decorate([
    (0, swagger_1.ApiTags)('Reproduction'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('reproduction/protocols'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [repro_protocol_service_1.ReproProtocolService])
], ReproProtocolController);
//# sourceMappingURL=repro-protocol.controller.js.map