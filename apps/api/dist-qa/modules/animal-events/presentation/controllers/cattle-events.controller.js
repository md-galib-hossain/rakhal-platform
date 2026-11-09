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
exports.CattleEventsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const permission_service_1 = require("src/modules/permission/application/services/permission.service");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const parse_payload_1 = require("../../application/parse-payload");
const event_registry_1 = require("../../domain/event-registry");
const animal_event_write_service_1 = require("../../application/services/animal-event-write.service");
const animal_event_types_service_1 = require("../../application/services/animal-event-types.service");
const timeline_service_1 = require("../../application/services/timeline.service");
const eligibility_service_1 = require("../../application/services/eligibility.service");
const animal_event_edit_service_1 = require("../../application/services/animal-event-edit.service");
const edit_event_dto_1 = require("../dto/edit-event.dto");
const record_event_dto_1 = require("../dto/record-event.dto");
const list_cattle_events_dto_1 = require("../dto/list-cattle-events.dto");
let CattleEventsController = class CattleEventsController {
    timeline;
    eligibility;
    writer;
    permissions;
    edits;
    registry;
    constructor(timeline, eligibility, writer, permissions, edits, registry) {
        this.timeline = timeline;
        this.eligibility = eligibility;
        this.writer = writer;
        this.permissions = permissions;
        this.edits = edits;
        this.registry = registry;
    }
    async record(req, farmId, userId, id, dryRun, idempotencyKey, dto) {
        const def = this.registry.get(dto.type);
        if (!def) {
            throw (0, parse_payload_1.eventError)('EVENT_TYPE_UNKNOWN', `Unknown event type ${dto.type}`);
        }
        await this.permissions.assertPermissions(userId, farmId, req.auth.user.permissionsVersion, [def.permission]);
        return this.writer.record(farmId, userId, id, dto, {
            dryRun: dryRun === 'true' || dryRun === '1',
            idempotencyKey,
        });
    }
    editEvent(req, farmId, userId, id, eventId, dto) {
        return this.edits.edit(farmId, { userId, permissionsVersion: req.auth.user.permissionsVersion }, id, eventId, dto);
    }
    voidEvent(req, farmId, userId, id, eventId, dto) {
        return this.edits.void(farmId, { userId, permissionsVersion: req.auth.user.permissionsVersion }, id, eventId, dto.reason);
    }
    eligible(farmId, id, query) {
        return this.eligibility.eligible(farmId, id, query.date ? new Date(query.date) : undefined);
    }
    list(farmId, id, query) {
        return this.timeline.list(farmId, id, query);
    }
};
exports.CattleEventsController = CattleEventsController;
__decorate([
    (0, common_1.Post)(),
    (0, require_permission_decorator_1.RequirePermission)('cattle.event'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, decorators_1.CurrentFarmId)()),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __param(3, (0, common_1.Param)('id')),
    __param(4, (0, common_1.Query)('dryRun')),
    __param(5, (0, common_1.Headers)('idempotency-key')),
    __param(6, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, Object, Object, record_event_dto_1.RecordEventDto]),
    __metadata("design:returntype", Promise)
], CattleEventsController.prototype, "record", null);
__decorate([
    (0, common_1.Patch)(':eventId'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.event'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, decorators_1.CurrentFarmId)()),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __param(3, (0, common_1.Param)('id')),
    __param(4, (0, common_1.Param)('eventId')),
    __param(5, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, edit_event_dto_1.EditEventDto]),
    __metadata("design:returntype", void 0)
], CattleEventsController.prototype, "editEvent", null);
__decorate([
    (0, common_1.Post)(':eventId/void'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.event'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, decorators_1.CurrentFarmId)()),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __param(3, (0, common_1.Param)('id')),
    __param(4, (0, common_1.Param)('eventId')),
    __param(5, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, edit_event_dto_1.VoidEventDto]),
    __metadata("design:returntype", void 0)
], CattleEventsController.prototype, "voidEvent", null);
__decorate([
    (0, common_1.Get)('eligible'),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, list_cattle_events_dto_1.EligibleEventsDto]),
    __metadata("design:returntype", void 0)
], CattleEventsController.prototype, "eligible", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('cattle.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, list_cattle_events_dto_1.ListCattleEventsDto]),
    __metadata("design:returntype", void 0)
], CattleEventsController.prototype, "list", null);
exports.CattleEventsController = CattleEventsController = __decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('cattle/:id/events'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __param(5, (0, common_1.Inject)(animal_event_types_service_1.EVENT_REGISTRY)),
    __metadata("design:paramtypes", [timeline_service_1.TimelineService,
        eligibility_service_1.EligibilityService,
        animal_event_write_service_1.AnimalEventWriteService,
        permission_service_1.PermissionService,
        animal_event_edit_service_1.AnimalEventEditService,
        event_registry_1.EventRegistry])
], CattleEventsController);
//# sourceMappingURL=cattle-events.controller.js.map