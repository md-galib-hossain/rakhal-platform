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
var OnboardingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const settings_service_1 = require("src/modules/settings/application/services/settings.service");
const workspace_settings_service_1 = require("src/modules/settings/application/services/workspace-settings.service");
const subscription_access_service_1 = require("src/modules/subscription/application/services/subscription-access.service");
const cattle_import_service_1 = require("src/modules/cattle/application/services/cattle-import.service");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
let OnboardingService = OnboardingService_1 = class OnboardingService {
    prisma;
    settings;
    workspace;
    subscriptionAccess;
    cattleImport;
    log;
    constructor(prisma, settings, workspace, subscriptionAccess, cattleImport, logger) {
        this.prisma = prisma;
        this.settings = settings;
        this.workspace = workspace;
        this.subscriptionAccess = subscriptionAccess;
        this.cattleImport = cattleImport;
        this.log = logger.setContext(OnboardingService_1.name);
    }
    async status(farmId) {
        const [farm, sheds, cattle, members] = await Promise.all([
            this.prisma.farm.findUniqueOrThrow({
                where: { id: farmId },
                select: { hasCompletedOnboarding: true },
            }),
            this.prisma.shed.count({ where: { farmId, deletedAt: null } }),
            this.prisma.cattle.count({
                where: (0, herd_scope_1.activeHerd)(farmId),
            }),
            this.prisma.farmMember.count({ where: { farmId } }),
        ]);
        return {
            has_completed_onboarding: farm.hasCompletedOnboarding,
            steps: {
                farm: { done: true },
                configure: { done: sheds > 0, sheds },
                cattle: { done: cattle > 0, count: cattle },
                team: { done: members > 1, members },
            },
        };
    }
    async configure(farmId, dto) {
        let shedsCreated = 0;
        for (const shed of dto.sheds ?? []) {
            await this.settings.createShed(farmId, {
                name: shed.name,
                capacity: shed.capacity,
                purpose: this.mapPurpose(shed.purpose),
            });
            shedsCreated += 1;
        }
        let sessionsConfigured = null;
        if (dto.active_sessions || dto.milk_unit) {
            const updated = await this.workspace.updateModules(farmId, {
                milk: {
                    ...(dto.active_sessions
                        ? { active_sessions: dto.active_sessions }
                        : {}),
                    ...(dto.milk_unit ? { milk_unit: dto.milk_unit } : {}),
                },
            });
            sessionsConfigured = updated.milk.active_sessions;
        }
        this.log.info('Onboarding configured', { farmId, shedsCreated });
        return {
            sheds_created: shedsCreated,
            sessions_configured: sessionsConfigured,
        };
    }
    async complete(farmId) {
        await this.prisma.farm.update({
            where: { id: farmId },
            data: { hasCompletedOnboarding: true },
        });
        this.log.info('Onboarding completed', { farmId });
        return { has_completed_onboarding: true };
    }
    importCattlePreview(farmId, file, mapping) {
        return this.cattleImport.preview(farmId, file, mapping);
    }
    importCattleConfirm(farmId, userId, dto) {
        return this.cattleImport.confirm(farmId, userId, dto);
    }
    async previewInvite(token) {
        const invite = await this.prisma.farmInvitation.findUnique({
            where: { token },
            select: {
                status: true,
                expiresAt: true,
                farm: { select: { name: true } },
                role: { select: { name: true } },
                invitedBy: { select: { name: true } },
            },
        });
        if (!invite)
            throw new common_1.NotFoundException('Invite not found');
        const isExpired = invite.status === client_1.InvitationStatus.EXPIRED ||
            invite.expiresAt.getTime() < Date.now();
        return {
            farm_name: invite.farm.name,
            role: invite.role.name.toLowerCase(),
            invited_by: invite.invitedBy.name,
            status: isExpired ? 'expired' : invite.status.toLowerCase(),
            expires_at: invite.expiresAt,
        };
    }
    async acceptInvite(userId, token) {
        const invite = await this.prisma.farmInvitation.findUnique({
            where: { token },
        });
        if (!invite)
            throw new common_1.NotFoundException('Invite not found');
        if (invite.status === client_1.InvitationStatus.ACCEPTED) {
            throw new common_1.BadRequestException('Invite has already been accepted');
        }
        if (invite.status !== client_1.InvitationStatus.PENDING) {
            throw new common_1.BadRequestException('Invite is no longer valid');
        }
        if (invite.expiresAt.getTime() < Date.now()) {
            await this.prisma.farmInvitation.update({
                where: { id: invite.id },
                data: { status: client_1.InvitationStatus.EXPIRED },
            });
            throw new common_1.GoneException('Invite has expired');
        }
        const caller = await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { email: true },
        });
        if (caller.email.toLowerCase() !== invite.email.toLowerCase()) {
            throw new common_1.ForbiddenException('This invite was sent to a different email address');
        }
        const existing = await this.prisma.farmMember.findUnique({
            where: { farmId_userId: { farmId: invite.farmId, userId } },
            select: { id: true },
        });
        if (existing) {
            throw new common_1.ConflictException('You are already a member of this farm');
        }
        const memberCount = await this.prisma.farmMember.count({
            where: { farmId: invite.farmId },
        });
        await this.subscriptionAccess.assertMemberSeatAvailable(invite.farmId, memberCount);
        await this.prisma.$transaction([
            this.prisma.farmMember.create({
                data: {
                    farmId: invite.farmId,
                    userId,
                    roleId: invite.roleId,
                    invitedById: invite.invitedById,
                },
            }),
            this.prisma.farmInvitation.update({
                where: { id: invite.id },
                data: { status: client_1.InvitationStatus.ACCEPTED, acceptedAt: new Date() },
            }),
        ]);
        const [farm, role] = await Promise.all([
            this.prisma.farm.findUniqueOrThrow({
                where: { id: invite.farmId },
                select: { id: true, name: true },
            }),
            this.prisma.role.findUniqueOrThrow({
                where: { id: invite.roleId },
                select: { name: true },
            }),
        ]);
        this.log.info('Invite accepted', {
            inviteId: invite.id,
            farmId: invite.farmId,
            userId,
        });
        return {
            farm_id: farm.id,
            farm_name: farm.name,
            role: role.name.toLowerCase(),
        };
    }
    mapPurpose(purpose) {
        if (!purpose)
            return undefined;
        const upper = purpose.toUpperCase();
        return Object.values(client_1.ShedPurpose).includes(upper)
            ? upper
            : client_1.ShedPurpose.GENERAL;
    }
};
exports.OnboardingService = OnboardingService;
exports.OnboardingService = OnboardingService = OnboardingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        settings_service_1.SettingsService,
        workspace_settings_service_1.WorkspaceSettingsService,
        subscription_access_service_1.SubscriptionAccessService,
        cattle_import_service_1.CattleImportService,
        logger_service_1.LoggerService])
], OnboardingService);
//# sourceMappingURL=onboarding.service.js.map