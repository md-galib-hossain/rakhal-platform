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
exports.NotificationController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const current_language_decorator_1 = require("src/common/decorators/current-language.decorator");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const notification_service_1 = require("../../application/services/notification.service");
const device_token_service_1 = require("../../application/services/device-token.service");
const channel_router_service_1 = require("../../application/services/channel-router.service");
const list_notification_query_dto_1 = require("../dto/list-notification-query.dto");
const update_preferences_dto_1 = require("../dto/update-preferences.dto");
const register_device_dto_1 = require("../dto/register-device.dto");
const set_routing_dto_1 = require("../dto/set-routing.dto");
const swagger_1 = require("@nestjs/swagger");
let NotificationController = class NotificationController {
    notifications;
    devices;
    routing;
    constructor(notifications, devices, routing) {
        this.notifications = notifications;
        this.devices = devices;
        this.routing = routing;
    }
    registerDevice(farmId, userId, dto) {
        return this.devices.register(userId, farmId, dto);
    }
    listDevices(userId) {
        return this.devices.list(userId);
    }
    unregisterDevice(userId, dto) {
        return this.devices.unregister(userId, dto.token);
    }
    list(farmId, userId, query, lang) {
        return this.notifications.list(farmId, userId, query, lang);
    }
    markRead(farmId, userId, id) {
        return this.notifications.markRead(farmId, userId, id);
    }
    markAllRead(farmId, userId) {
        return this.notifications.markAllRead(farmId, userId);
    }
    getPreferences(farmId, userId) {
        return this.notifications.getPreferences(farmId, userId);
    }
    updatePreferences(farmId, userId, dto) {
        return this.notifications.updatePreferences(farmId, userId, dto);
    }
    getRouting(farmId) {
        return this.routing.getFarmRouting(farmId);
    }
    setRouting(farmId, eventKey, dto) {
        return this.routing.setFarmRule(farmId, eventKey, dto.channels);
    }
    deleteRouting(farmId, eventKey) {
        return this.routing.deleteFarmRule(farmId, eventKey);
    }
};
exports.NotificationController = NotificationController;
__decorate([
    (0, common_1.Post)('devices'),
    (0, require_permission_decorator_1.RequirePermission)('notification.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, register_device_dto_1.RegisterDeviceDto]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "registerDevice", null);
__decorate([
    (0, common_1.Get)('devices'),
    (0, require_permission_decorator_1.RequirePermission)('notification.read'),
    __param(0, (0, decorators_1.CurrentUserId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "listDevices", null);
__decorate([
    (0, common_1.Delete)('devices'),
    (0, require_permission_decorator_1.RequirePermission)('notification.read'),
    __param(0, (0, decorators_1.CurrentUserId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, register_device_dto_1.RegisterDeviceDto]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "unregisterDevice", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('notification.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Query)()),
    __param(3, (0, current_language_decorator_1.CurrentLanguage)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, list_notification_query_dto_1.ListNotificationQueryDto, String]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':id/read'),
    (0, require_permission_decorator_1.RequirePermission)('notification.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "markRead", null);
__decorate([
    (0, common_1.Post)('read-all'),
    (0, require_permission_decorator_1.RequirePermission)('notification.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "markAllRead", null);
__decorate([
    (0, common_1.Get)('preferences'),
    (0, require_permission_decorator_1.RequirePermission)('notification.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "getPreferences", null);
__decorate([
    (0, common_1.Patch)('preferences'),
    (0, require_permission_decorator_1.RequirePermission)('notification.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_preferences_dto_1.UpdatePreferencesDto]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "updatePreferences", null);
__decorate([
    (0, common_1.Get)('routing'),
    (0, require_permission_decorator_1.RequirePermission)('notification.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "getRouting", null);
__decorate([
    (0, common_1.Put)('routing/:eventKey'),
    (0, require_permission_decorator_1.RequirePermission)('notification.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('eventKey')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, set_routing_dto_1.SetRoutingDto]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "setRouting", null);
__decorate([
    (0, common_1.Delete)('routing/:eventKey'),
    (0, require_permission_decorator_1.RequirePermission)('notification.update'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('eventKey')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "deleteRouting", null);
exports.NotificationController = NotificationController = __decorate([
    (0, swagger_1.ApiTags)('Notifications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('notifications'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [notification_service_1.NotificationService,
        device_token_service_1.DeviceTokenService,
        channel_router_service_1.ChannelRouterService])
], NotificationController);
//# sourceMappingURL=notification.controller.js.map