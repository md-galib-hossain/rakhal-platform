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
exports.TeamController = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const farm_context_guard_1 = require("src/modules/tenant-access/presentation/guards/farm-context.guard");
const permission_guard_1 = require("src/modules/permission/presentation/guards/permission.guard");
const subscription_guard_1 = require("src/modules/subscription/presentation/guards/subscription.guard");
const require_permission_decorator_1 = require("src/modules/permission/presentation/decorators/require-permission.decorator");
const team_service_1 = require("../../application/services/team.service");
const invite_team_member_dto_1 = require("../dto/invite-team-member.dto");
const change_member_role_dto_1 = require("../dto/change-member-role.dto");
const swagger_1 = require("@nestjs/swagger");
let TeamController = class TeamController {
    teamService;
    constructor(teamService) {
        this.teamService = teamService;
    }
    list(farmId) {
        return this.teamService.listTeam(farmId);
    }
    invite(farmId, userId, dto) {
        return this.teamService.invite(farmId, userId, dto);
    }
    resend(farmId, id) {
        return this.teamService.resendInvite(farmId, id);
    }
    revokeInvite(farmId, id) {
        return this.teamService.revokeInvite(farmId, id);
    }
    changeRole(farmId, userId, id, dto) {
        return this.teamService.changeRole(farmId, userId, id, dto);
    }
    remove(farmId, userId, id) {
        return this.teamService.removeMember(farmId, userId, id);
    }
};
exports.TeamController = TeamController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permission_decorator_1.RequirePermission)('team.read'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TeamController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('invite'),
    (0, require_permission_decorator_1.RequirePermission)('team.invite'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, invite_team_member_dto_1.InviteTeamMemberDto]),
    __metadata("design:returntype", void 0)
], TeamController.prototype, "invite", null);
__decorate([
    (0, common_1.Post)('invites/:id/resend'),
    (0, require_permission_decorator_1.RequirePermission)('team.invite'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TeamController.prototype, "resend", null);
__decorate([
    (0, common_1.Delete)('invites/:id'),
    (0, require_permission_decorator_1.RequirePermission)('team.invite'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TeamController.prototype, "revokeInvite", null);
__decorate([
    (0, common_1.Patch)(':id/role'),
    (0, require_permission_decorator_1.RequirePermission)('team.invite'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, change_member_role_dto_1.ChangeMemberRoleDto]),
    __metadata("design:returntype", void 0)
], TeamController.prototype, "changeRole", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permission_decorator_1.RequirePermission)('team.remove'),
    __param(0, (0, decorators_1.CurrentFarmId)()),
    __param(1, (0, decorators_1.CurrentUserId)()),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], TeamController.prototype, "remove", null);
exports.TeamController = TeamController = __decorate([
    (0, swagger_1.ApiTags)('Team'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('settings/team'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard, farm_context_guard_1.FarmContextGuard, permission_guard_1.PermissionGuard, subscription_guard_1.SubscriptionGuard),
    __metadata("design:paramtypes", [team_service_1.TeamService])
], TeamController);
//# sourceMappingURL=team.controller.js.map