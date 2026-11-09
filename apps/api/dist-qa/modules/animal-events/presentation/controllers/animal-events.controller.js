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
exports.AnimalEventsController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const permission_service_1 = require("src/modules/permission/application/services/permission.service");
const parse_payload_1 = require("../../application/parse-payload");
const event_registry_1 = require("../../domain/event-registry");
const bulk_event_service_1 = require("../../application/services/bulk-event.service");
const animal_event_types_service_1 = require("../../application/services/animal-event-types.service");
const bulk_event_dto_1 = require("../dto/bulk-event.dto");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const animal_event_types_service_2 = require("../../application/services/animal-event-types.service");
let AnimalEventsController = class AnimalEventsController {
    types;
    bulkEvents;
    permissions;
    registry;
    constructor(types, bulkEvents, permissions, registry) {
        this.types = types;
        this.bulkEvents = bulkEvents;
        this.permissions = permissions;
        this.registry = registry;
    }
    async bulk(req, farmId, userId, dryRun, dto) {
        const def = this.registry.get(dto.type);
        if (!def) {
            throw (0, parse_payload_1.eventError)('EVENT_TYPE_UNKNOWN', `Unknown event type ${dto.type}`);
        }
        await this.permissions.assertPermissions(userId, farmId, req.auth.user.permissionsVersion, ['cattle.event', def.permission]);
        return this.bulkEvents.bulk(farmId, userId, dto, {
            dryRun: dryRun === 'true' || dryRun === '1',
        });
    }
    listTypes(farmId) {
        return this.types.list(farmId);
    }
};
exports.AnimalEventsController = AnimalEventsController;
__decorate([
    (0, common_1.Post)('bulk'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.bulk'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, decorators_1.CurrentFarmId)()),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __param(3, (0, common_1.Query)('dryRun')),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object, bulk_event_dto_1.BulkEventDto]),
    __metadata("design:returntype", Promise)
], AnimalEventsController.prototype, "bulk", null);
__decorate([
    (0, common_1.Get)('types'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AnimalEventsController.prototype, "listTypes", null);
exports.AnimalEventsController = AnimalEventsController = __decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('animal-events'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __param(3, (0, common_1.Inject)(animal_event_types_service_1.EVENT_REGISTRY)),
    __metadata("design:paramtypes", [animal_event_types_service_2.AnimalEventTypesService,
        bulk_event_service_1.BulkEventService,
        permission_service_1.PermissionService,
        event_registry_1.EventRegistry])
], AnimalEventsController);
//# sourceMappingURL=animal-events.controller.js.map