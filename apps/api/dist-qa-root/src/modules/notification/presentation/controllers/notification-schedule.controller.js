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
exports.NotificationScheduleController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const dto_1 = require("src/common/dto");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const permission_service_1 = require("src/modules/permission/application/services/permission.service");
const notification_schedule_service_1 = require("../../application/services/notification-schedule.service");
const create_notification_schedule_dto_1 = require("../dto/create-notification-schedule.dto");
const list_notification_schedules_query_dto_1 = require("../dto/list-notification-schedules-query.dto");
const upcoming_notifications_query_dto_1 = require("../dto/upcoming-notifications-query.dto");
const update_notification_schedule_dto_1 = require("../dto/update-notification-schedule.dto");
let NotificationScheduleController = class NotificationScheduleController {
    schedules;
    permissions;
    constructor(schedules, permissions) {
        this.schedules = schedules;
        this.permissions = permissions;
    }
    async actor(req, farmId, userId) {
        const canManage = await this.permissions.hasPermission(userId, farmId, req.auth.user.permissionsVersion, ['notification.manage']);
        return { userId, canManage };
    }
    async upcoming(req, farmId, userId, query) {
        return this.schedules.upcoming(farmId, await this.actor(req, farmId, userId), query);
    }
    async list(req, farmId, userId, query) {
        return this.schedules.list(farmId, await this.actor(req, farmId, userId), query);
    }
    async preview(req, farmId, userId, dto) {
        return this.schedules.preview(farmId, await this.actor(req, farmId, userId), dto);
    }
    async create(req, farmId, userId, dto) {
        return this.schedules.create(farmId, await this.actor(req, farmId, userId), dto);
    }
    async get(req, farmId, userId, { id }) {
        return this.schedules.get(farmId, await this.actor(req, farmId, userId), id);
    }
    async update(req, farmId, userId, { id }, dto) {
        return this.schedules.update(farmId, await this.actor(req, farmId, userId), id, dto);
    }
    async pause(req, farmId, userId, { id }) {
        return this.schedules.pause(farmId, await this.actor(req, farmId, userId), id);
    }
    async resume(req, farmId, userId, { id }) {
        return this.schedules.resume(farmId, await this.actor(req, farmId, userId), id);
    }
    async cancel(req, farmId, userId, { id }) {
        return this.schedules.cancel(farmId, await this.actor(req, farmId, userId), id);
    }
};
exports.NotificationScheduleController = NotificationScheduleController;
__decorate([
    (0, common_1.Get)('upcoming'),
    (0, require_permission_decorator_1.RequirePermission)('notification.read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, decorators_1.CurrentFarmId)()),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __param(3, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, upcoming_notifications_query_dto_1.UpcomingNotificationsQueryDto]),
    __metadata("design:returntype", Promise)
], NotificationScheduleController.prototype, "upcoming", null);
__decorate([
    (0, common_1.Get)('schedules'),
    (0, require_permission_decorator_1.RequirePermission)('notification.read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, decorators_1.CurrentFarmId)()),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __param(3, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, list_notification_schedules_query_dto_1.ListNotificationSchedulesQueryDto]),
    __metadata("design:returntype", Promise)
], NotificationScheduleController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('schedules/preview'),
    (0, require_permission_decorator_1.RequirePermission)('notification.create'),
    (0, decorators_1.ThrottleWrite)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, decorators_1.CurrentFarmId)()),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, create_notification_schedule_dto_1.CreateNotificationScheduleDto]),
    __metadata("design:returntype", Promise)
], NotificationScheduleController.prototype, "preview", null);
__decorate([
    (0, common_1.Post)('schedules'),
    (0, require_permission_decorator_1.RequirePermission)('notification.create'),
    (0, decorators_1.ThrottleWrite)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, decorators_1.CurrentFarmId)()),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, create_notification_schedule_dto_1.CreateNotificationScheduleDto]),
    __metadata("design:returntype", Promise)
], NotificationScheduleController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('schedules/:id'),
    (0, require_permission_decorator_1.RequirePermission)('notification.read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, decorators_1.CurrentFarmId)()),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __param(3, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], NotificationScheduleController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)('schedules/:id'),
    (0, require_permission_decorator_1.RequirePermission)('notification.create'),
    (0, decorators_1.ThrottleWrite)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, decorators_1.CurrentFarmId)()),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __param(3, (0, common_1.Param)()),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, dto_1.IdParamDto,
        update_notification_schedule_dto_1.UpdateNotificationScheduleDto]),
    __metadata("design:returntype", Promise)
], NotificationScheduleController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('schedules/:id/pause'),
    (0, require_permission_decorator_1.RequirePermission)('notification.create'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, decorators_1.CurrentFarmId)()),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __param(3, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], NotificationScheduleController.prototype, "pause", null);
__decorate([
    (0, common_1.Post)('schedules/:id/resume'),
    (0, require_permission_decorator_1.RequirePermission)('notification.create'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, decorators_1.CurrentFarmId)()),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __param(3, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], NotificationScheduleController.prototype, "resume", null);
__decorate([
    (0, common_1.Delete)('schedules/:id'),
    (0, require_permission_decorator_1.RequirePermission)('notification.create'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, decorators_1.CurrentFarmId)()),
    __param(2, (0, decorators_1.CurrentUserId)()),
    __param(3, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], NotificationScheduleController.prototype, "cancel", null);
exports.NotificationScheduleController = NotificationScheduleController = __decorate([
    (0, swagger_1.ApiTags)('Notifications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('notifications'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard),
    __metadata("design:paramtypes", [notification_schedule_service_1.NotificationScheduleService,
        permission_service_1.PermissionService])
], NotificationScheduleController);
//# sourceMappingURL=notification-schedule.controller.js.map