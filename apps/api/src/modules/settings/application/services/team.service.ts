import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InvitationStatus } from '@prisma/client';
import { AppLanguage } from 'src/common/i18n/language';
import { emailConfig } from 'src/core/config/env';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { SubscriptionAccessService } from 'src/modules/subscription/application/services/subscription-access.service';
import { TransactionalEmailService } from 'src/modules/email/application/services/transactional-email.service';
import { EmailTemplate } from 'src/modules/email/domain/enums/email-template.enum';
import { SYSTEM_ROLES } from 'src/modules/permission/domain/permission-catalogue';
import { InviteTeamMemberDto } from '../../presentation/dto/invite-team-member.dto';
import { ChangeMemberRoleDto } from '../../presentation/dto/change-member-role.dto';

/** Invites live for this many days before they expire (PRD §21.4). */
const INVITE_TTL_DAYS = 7;

/**
 * Team & Invites (PRD §21.4 / API §18 — RAKHAL-030). Lists active members + pending
 * invites, invites by email (no SMS provider is wired — `phone` is optional metadata
 * for a future SMS adapter), and removes members (never self or the farm owner).
 * `farmId` from the token context.
 */
@Injectable()
export class TeamService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly txEmail: TransactionalEmailService,
    @Inject(emailConfig.KEY)
    private readonly email: ConfigType<typeof emailConfig>,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(TeamService.name);
  }

  async listTeam(farmId: string) {
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
        where: { farmId, status: InvitationStatus.PENDING },
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
      phone: null, // phone-first auth not yet stored on User (PRD §5 blocked)
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

  async invite(farmId: string, userId: string, dto: InviteTeamMemberDto) {
    const roleId = await this.resolveRoleId(farmId, dto.role);

    const existing = await this.prisma.farmInvitation.findFirst({
      where: {
        farmId,
        email: { equals: dto.email, mode: 'insensitive' },
        status: InvitationStatus.PENDING,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'A pending invite already exists for this email',
      );
    }

    // RAKHAL-219 / PRD §31.3 assertMemberLimit — check the seat ceiling at
    // invite time (counting pending invites, not just accepted members), so
    // the owner learns about a full plan before the invitee ever signs up.
    const [memberCount, pendingInviteCount] = await Promise.all([
      this.prisma.farmMember.count({ where: { farmId } }),
      this.prisma.farmInvitation.count({
        where: { farmId, status: InvitationStatus.PENDING },
      }),
    ]);
    await this.subscriptionAccess.assertMemberSeatAvailable(
      farmId,
      memberCount + pendingInviteCount,
    );

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

  async resendInvite(farmId: string, id: string) {
    const invite = await this.prisma.farmInvitation.findFirst({
      where: { id, farmId },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestException('Invite has already been accepted');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);
    const updated = await this.prisma.farmInvitation.update({
      where: { id },
      data: { status: InvitationStatus.PENDING, expiresAt },
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

  /** `DELETE /settings/team/invites/:id` — cancel a pending invite. Never redeemable again. */
  async revokeInvite(farmId: string, id: string) {
    const invite = await this.prisma.farmInvitation.findFirst({
      where: { id, farmId },
      select: { id: true, status: true },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestException('Invite has already been accepted');
    }

    await this.prisma.farmInvitation.update({
      where: { id },
      data: { status: InvitationStatus.REVOKED },
    });

    this.log.info('Team invite revoked', { inviteId: id, farmId });
    return { id, revoked: true };
  }

  /** `PATCH /settings/team/:id/role` — reassign an existing member's role. */
  async changeRole(
    farmId: string,
    requesterId: string,
    memberId: string,
    dto: ChangeMemberRoleDto,
  ) {
    const member = await this.prisma.farmMember.findFirst({
      where: { id: memberId, farmId },
      select: { id: true, userId: true },
    });
    if (!member) throw new NotFoundException('Team member not found');

    const farm = await this.prisma.farm.findUniqueOrThrow({
      where: { id: farmId },
      select: { ownerId: true },
    });
    if (member.userId === farm.ownerId) {
      throw new BadRequestException("The farm owner's role cannot be changed");
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

  private async sendInviteEmail(input: {
    farmId: string;
    userId: string;
    inviteId: string;
  }): Promise<void> {
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
        // A resend intentionally reuses the same key as the invite's own creation
        // send — BullMQ/EmailLog idempotency is per (event, entity), and "resend"
        // is a deliberate exception the caller opts into, not a replay to dedupe.
        idempotencyKey: `team-invite:${input.inviteId}:${invite.expiresAt.getTime()}`,
        to: invite.email,
        subject: `${invite.invitedBy.name} invited you to join ${invite.farm.name} on Rakhal`,
        template: EmailTemplate.TEAM_INVITE,
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
        locale: invite.invitedBy.preferredLanguage.toLowerCase() as AppLanguage,
      });
    } catch (err) {
      // Best-effort — mirrors the welcome-email pattern (FarmService.create):
      // an email hiccup must never fail invite creation itself.
      this.log.error('Team invite email failed (invite still created)', err);
    }
  }

  async removeMember(farmId: string, requesterId: string, memberId: string) {
    const member = await this.prisma.farmMember.findFirst({
      where: { id: memberId, farmId },
      select: { id: true, userId: true },
    });
    if (!member) throw new NotFoundException('Team member not found');

    if (member.userId === requesterId) {
      throw new BadRequestException('You cannot remove yourself');
    }

    const farm = await this.prisma.farm.findUniqueOrThrow({
      where: { id: farmId },
      select: { ownerId: true },
    });
    if (member.userId === farm.ownerId) {
      throw new BadRequestException('The farm owner cannot be removed');
    }

    await this.prisma.farmMember.delete({ where: { id: member.id } });
    await this.permissions.invalidateForFarm(member.userId, farmId);

    this.log.info('Team member removed', { memberId, farmId });
    return { id: member.id, removed: true };
  }

  /**
   * Resolve an invite `role` (custom role id for this farm, or a role name) to a roleId.
   *
   * A farm only ever gets the Owner role for free — Manager/Worker are **not**
   * name-resolvable here, so inviting `role: "Manager"` on a farm that never created its
   * own "Manager" custom role 400s instead of silently landing on the global system
   * template. The owner has to create that role first (Settings > Team > Roles,
   * optionally starting from a Manager/Worker template) before anyone can be invited
   * into it — matches `RolesService.listRoles()` only ever showing Owner + this farm's
   * own custom roles.
   */
  private async resolveRoleId(farmId: string, role: string): Promise<string> {
    const isOwnerName =
      role.trim().toLowerCase() === SYSTEM_ROLES.OWNER.toLowerCase();

    const found = await this.prisma.role.findFirst({
      where: {
        OR: [
          { id: role, OR: [{ farmId }, { farmId: null }] },
          ...(isOwnerName
            ? [{ name: SYSTEM_ROLES.OWNER, isSystemRole: true }]
            : []),
          { name: { equals: role, mode: 'insensitive' }, farmId },
        ],
      },
      select: { id: true },
    });
    if (!found) {
      throw new BadRequestException(`Unknown role: ${role}`);
    }
    return found.id;
  }
}
