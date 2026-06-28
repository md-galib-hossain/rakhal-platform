import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { InviteTeamMemberDto } from '../../presentation/dto/invite-team-member.dto';

/** Invites live for this many days before they expire (PRD §21.4). */
const INVITE_TTL_DAYS = 7;

/**
 * Team & Invites (PRD §21.4 / API §18 — RAKHAL-030). Lists active members + pending
 * invites, invites by phone (SMS delivery stubbed until a provider is chosen — PRD
 * §5 blocked), and removes members (never self or the farm owner). `farmId` from the
 * token context.
 */
@Injectable()
export class TeamService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
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
      email: null,
      role: i.role.name.toLowerCase(),
      status: i.expiresAt < now ? 'expired' : 'pending',
      last_active_at: null,
      expires_at: i.expiresAt,
    }));

    return { members: [...memberRows, ...inviteRows] };
  }

  async invite(farmId: string, userId: string, dto: InviteTeamMemberDto) {
    const roleId = await this.resolveRoleId(farmId, dto.role);

    // Already an active member with this phone? (phone not on User yet — guard on pending invites only.)
    const existing = await this.prisma.farmInvitation.findFirst({
      where: {
        farmId,
        phone: dto.phone,
        status: InvitationStatus.PENDING,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'A pending invite already exists for this phone number',
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    const invite = await this.prisma.farmInvitation.create({
      data: {
        farmId,
        phone: dto.phone,
        name: dto.name,
        roleId,
        invitedById: userId,
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    });

    // SMS delivery is stubbed until an SMS provider is chosen (PRD §5 blocked).
    this.log.info('Team invite created (SMS stubbed)', {
      inviteId: invite.id,
      farmId,
    });
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

    this.log.info('Team invite resent (SMS stubbed)', { inviteId: id, farmId });
    return {
      invite_id: updated.id,
      sms_sent: false,
      expires_at: updated.expiresAt,
    };
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

  /** Resolve an invite `role` (custom role id for this farm, or a system role name) to a roleId. */
  private async resolveRoleId(farmId: string, role: string): Promise<string> {
    const found = await this.prisma.role.findFirst({
      where: {
        OR: [
          { id: role, OR: [{ farmId }, { farmId: null }] },
          { name: { equals: role, mode: 'insensitive' }, isSystemRole: true },
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
