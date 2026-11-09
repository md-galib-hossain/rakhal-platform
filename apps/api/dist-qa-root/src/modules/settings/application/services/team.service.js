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
var TeamService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const env_1 = require("src/core/config/env");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const permission_service_1 = require("src/modules/permission/application/services/permission.service");
const subscription_access_service_1 = require("src/modules/subscription/application/services/subscription-access.service");
const transactional_email_service_1 = require("src/modules/email/application/services/transactional-email.service");
const email_template_enum_1 = require("src/modules/email/domain/enums/email-template.enum");
const permission_catalogue_1 = require("src/modules/permission/domain/permission-catalogue");
const INVITE_TTL_DAYS = 7;
let TeamService = TeamService_1 = class TeamService {
    prisma;
    permissions;
    subscriptionAccess;
    txEmail;
    email;
    log;
    constructor(prisma, permissions, subscriptionAccess, txEmail, email, logger) {
        this.prisma = prisma;
        this.permissions = permissions;
        this.subscriptionAccess = subscriptionAccess;
        this.txEmail = txEmail;
        this.email = email;
        this.log = logger.setContext(TeamService_1.name);
    }
    async listTeam(farmId) {
        const now = new Date();
        const [members, invites] = await Promise.all([
            this.prisma.farmMember.findMany({
                where: { farmId },
                include: {
                    user: {
                        select: { id: true, name: true, email: true, lastLoginAt: true },
                    },
                    role: { select: { name: true } },
                },
                orderBy: { joinedAt: 'asc' },
            }),
            this.prisma.farmInvitation.findMany({
                where: { farmId, status: client_1.InvitationStatus.PENDING },
                include: { role: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        const farm = await this.prisma.farm.findUniqueOrThrow({
            where: { id: farmId },
            select: { ownerId: true },
        });
        const memberRows = members.map((m) => ({
            id: m.userId,
            member_id: m.id,
            name: m.user.name,
            phone: null,
            email: m.user.email,
            role: m.role.name.toLowerCase(),
            status: 'active',
            last_active_at: m.user.lastLoginAt,
            is_owner: m.userId === farm.ownerId,
        }));
        const inviteRows = invites.map((i) => ({
            id: i.id,
            invite_id: i.id,
            name: i.name,
            phone: i.phone,
            email: i.email,
            role: i.role.name.toLowerCase(),
            status: i.expiresAt < now ? 'expired' : 'pending',
            last_active_at: null,
            expires_at: i.expiresAt,
        }));
        return { members: [...memberRows, ...inviteRows] };
    }
    async invite(farmId, userId, dto) {
        const roleId = await this.resolveRoleId(farmId, dto.role);
        const existing = await this.prisma.farmInvitation.findFirst({
            where: {
                farmId,
                email: { equals: dto.email, mode: 'insensitive' },
                status: client_1.InvitationStatus.PENDING,
            },
            select: { id: true },
        });
        if (existing) {
            throw new common_1.ConflictException('A pending invite already exists for this email');
        }
        const [memberCount, pendingInviteCount] = await Promise.all([
            this.prisma.farmMember.count({ where: { farmId } }),
            this.prisma.farmInvitation.count({
                where: { farmId, status: client_1.InvitationStatus.PENDING },
            }),
        ]);
        await this.subscriptionAccess.assertMemberSeatAvailable(farmId, memberCount + pendingInviteCount);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);
        const invite = await this.prisma.farmInvitation.create({
            data: {
                farmId,
                email: dto.email,
                phone: dto.phone,
                name: dto.name,
                roleId,
                invitedById: userId,
                expiresAt,
            },
            select: { id: true, expiresAt: true, token: true },
        });
        await this.sendInviteEmail({ farmId, userId, inviteId: invite.id });
        this.log.info('Team invite created', { inviteId: invite.id, farmId });
        return {
            invite_id: invite.id,
            sms_sent: false,
            expires_at: invite.expiresAt,
        };
    }
    async resendInvite(farmId, id) {
        const invite = await this.prisma.farmInvitation.findFirst({
            where: { id, farmId },
        });
        if (!invite)
            throw new common_1.NotFoundException('Invite not found');
        if (invite.status === client_1.InvitationStatus.ACCEPTED) {
            throw new common_1.BadRequestException('Invite has already been accepted');
        }
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);
        const updated = await this.prisma.farmInvitation.update({
            where: { id },
            data: { status: client_1.InvitationStatus.PENDING, expiresAt },
            select: { id: true, expiresAt: true },
        });
        await this.sendInviteEmail({
            farmId,
            userId: invite.invitedById,
            inviteId: id,
        });
        this.log.info('Team invite resent', { inviteId: id, farmId });
        return {
            invite_id: updated.id,
            sms_sent: false,
            expires_at: updated.expiresAt,
        };
    }
    async revokeInvite(farmId, id) {
        const invite = await this.prisma.farmInvitation.findFirst({
            where: { id, farmId },
            select: { id: true, status: true },
        });
        if (!invite)
            throw new common_1.NotFoundException('Invite not found');
        if (invite.status === client_1.InvitationStatus.ACCEPTED) {
            throw new common_1.BadRequestException('Invite has already been accepted');
        }
        await this.prisma.farmInvitation.update({
            where: { id },
            data: { status: client_1.InvitationStatus.REVOKED },
        });
        this.log.info('Team invite revoked', { inviteId: id, farmId });
        return { id, revoked: true };
    }
    async changeRole(farmId, requesterId, memberId, dto) {
        const member = await this.prisma.farmMember.findFirst({
            where: { id: memberId, farmId },
            select: { id: true, userId: true },
        });
        if (!member)
            throw new common_1.NotFoundException('Team member not found');
        const farm = await this.prisma.farm.findUniqueOrThrow({
            where: { id: farmId },
            select: { ownerId: true },
        });
        if (member.userId === farm.ownerId) {
            throw new common_1.BadRequestException("The farm owner's role cannot be changed");
        }
        const roleId = await this.resolveRoleId(farmId, dto.role);
        await this.prisma.farmMember.update({
            where: { id: member.id },
            data: { roleId },
        });
        await this.permissions.invalidateForFarm(member.userId, farmId);
        this.log.info('Team member role changed', {
            memberId,
            farmId,
            requesterId,
        });
        return { id: member.id, role: dto.role };
    }
    async sendInviteEmail(input) {
        const invite = await this.prisma.farmInvitation.findUniqueOrThrow({
            where: { id: input.inviteId },
            select: {
                token: true,
                email: true,
                expiresAt: true,
                role: { select: { name: true } },
                farm: { select: { name: true } },
                invitedBy: { select: { name: true, preferredLanguage: true } },
            },
        });
        const inviteLink = `${this.email.inviteBaseUrl}/${invite.token}`;
        try {
            await this.txEmail.sendOnce({
                idempotencyKey: `team-invite:${input.inviteId}:${invite.expiresAt.getTime()}`,
                to: invite.email,
                subject: `${invite.invitedBy.name} invited you to join ${invite.farm.name} on Rakhal`,
                template: email_template_enum_1.EmailTemplate.TEAM_INVITE,
                templateData: {
                    nameGreeting: '',
                    inviterName: invite.invitedBy.name,
                    farmName: invite.farm.name,
                    roleName: invite.role.name,
                    inviteLink,
                    expiresAt: invite.expiresAt.toDateString(),
                },
                tenantId: input.userId,
                farmId: input.farmId,
                userId: input.userId,
                locale: invite.invitedBy.preferredLanguage.toLowerCase(),
            });
        }
        catch (err) {
            this.log.error('Team invite email failed (invite still created)', err);
        }
    }
    async removeMember(farmId, requesterId, memberId) {
        const member = await this.prisma.farmMember.findFirst({
            where: { id: memberId, farmId },
            select: { id: true, userId: true },
        });
        if (!member)
            throw new common_1.NotFoundException('Team member not found');
        if (member.userId === requesterId) {
            throw new common_1.BadRequestException('You cannot remove yourself');
        }
        const farm = await this.prisma.farm.findUniqueOrThrow({
            where: { id: farmId },
            select: { ownerId: true },
        });
        if (member.userId === farm.ownerId) {
            throw new common_1.BadRequestException('The farm owner cannot be removed');
        }
        await this.prisma.farmMember.delete({ where: { id: member.id } });
        await this.permissions.invalidateForFarm(member.userId, farmId);
        this.log.info('Team member removed', { memberId, farmId });
        return { id: member.id, removed: true };
    }
    async resolveRoleId(farmId, role) {
        const isOwnerName = role.trim().toLowerCase() === permission_catalogue_1.SYSTEM_ROLES.OWNER.toLowerCase();
        const found = await this.prisma.role.findFirst({
            where: {
                OR: [
                    { id: role, OR: [{ farmId }, { farmId: null }] },
                    ...(isOwnerName
                        ? [{ name: permission_catalogue_1.SYSTEM_ROLES.OWNER, isSystemRole: true }]
                        : []),
                    { name: { equals: role, mode: 'insensitive' }, farmId },
                ],
            },
            select: { id: true },
        });
        if (!found) {
            throw new common_1.BadRequestException(`Unknown role: ${role}`);
        }
        return found.id;
    }
};
exports.TeamService = TeamService;
exports.TeamService = TeamService = TeamService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(env_1.emailConfig.KEY)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        permission_service_1.PermissionService,
        subscription_access_service_1.SubscriptionAccessService,
        transactional_email_service_1.TransactionalEmailService, void 0, logger_service_1.LoggerService])
], TeamService);
//# sourceMappingURL=team.service.js.map