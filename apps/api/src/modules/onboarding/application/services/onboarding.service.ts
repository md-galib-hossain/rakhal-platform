import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitationStatus, ShedPurpose } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { SettingsService } from 'src/modules/settings/application/services/settings.service';
import { WorkspaceSettingsService } from 'src/modules/settings/application/services/workspace-settings.service';
import { SubscriptionAccessService } from 'src/modules/subscription/application/services/subscription-access.service';
import { ConfigureOnboardingDto } from '../../presentation/dto/configure-onboarding.dto';

/**
 * Onboarding (PRD §5.1 / API §2 — RAKHAL-022/023/025). Orchestrates the wizard's
 * backend over already-built services: `configure` reuses Settings (sheds +
 * module settings), `status`/`complete` drive the `Farm.hasCompletedOnboarding`
 * flag, and `acceptInvite` closes the RAKHAL-030 invitation loop (token →
 * membership). Farm create + CSV import reuse the existing `POST /farms` and
 * `/cattle/import/*` routes. `farmId` comes from the token context (except
 * accept-invite, which is pre-membership and keyed off the invite token).
 */
@Injectable()
export class OnboardingService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly workspace: WorkspaceSettingsService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(OnboardingService.name);
  }

  /** `GET /onboarding/status` — resume state + per-step completion hints. */
  async status(farmId: string) {
    const [farm, sheds, cattle, members] = await Promise.all([
      this.prisma.farm.findUniqueOrThrow({
        where: { id: farmId },
        select: { hasCompletedOnboarding: true },
      }),
      this.prisma.shed.count({ where: { farmId, isActive: true } }),
      this.prisma.cattle.count({ where: { farmId, isActive: true } }),
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

  /** `POST /onboarding/configure` — create sheds + set milk sessions (Step 3). */
  async configure(farmId: string, dto: ConfigureOnboardingDto) {
    let shedsCreated = 0;
    for (const shed of dto.sheds ?? []) {
      await this.settings.createShed(farmId, {
        name: shed.name,
        capacity: shed.capacity,
        purpose: this.mapPurpose(shed.purpose),
      });
      shedsCreated += 1;
    }

    let sessionsConfigured: string[] | null = null;
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

  /** `POST /onboarding/complete` — mark the wizard done (Step 6). */
  async complete(farmId: string) {
    await this.prisma.farm.update({
      where: { id: farmId },
      data: { hasCompletedOnboarding: true },
    });
    this.log.info('Onboarding completed', { farmId });
    return { has_completed_onboarding: true };
  }

  /**
   * `GET /onboarding/invites/:token` — unauthenticated preview so the accept
   * page can render (farm name, role, inviter, expiry) before the invitee has
   * an account. Deliberately returns no more than this — never the invite's
   * email/phone/id.
   */
  async previewInvite(token: string) {
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
    if (!invite) throw new NotFoundException('Invite not found');

    const isExpired =
      invite.status === InvitationStatus.EXPIRED ||
      invite.expiresAt.getTime() < Date.now();

    return {
      farm_name: invite.farm.name,
      role: invite.role.name.toLowerCase(),
      invited_by: invite.invitedBy.name,
      status: isExpired ? 'expired' : invite.status.toLowerCase(),
      expires_at: invite.expiresAt,
    };
  }

  /**
   * `POST /onboarding/accept-invite` — the authenticated user redeems an invite
   * token, joining the farm with the invited role. Pre-membership: no farm
   * context guard; the token is the authorization.
   */
  async acceptInvite(userId: string, token: string) {
    const invite = await this.prisma.farmInvitation.findUnique({
      where: { token },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestException('Invite has already been accepted');
    }
    if (invite.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invite is no longer valid');
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      await this.prisma.farmInvitation.update({
        where: { id: invite.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new GoneException('Invite has expired');
    }

    // Bind the redeemer: only the invited email may accept — otherwise anyone
    // who obtains the token (it travels in plaintext by email) could join the
    // farm with the invited role.
    const caller = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    if (caller.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException(
        'This invite was sent to a different email address',
      );
    }

    const existing = await this.prisma.farmMember.findUnique({
      where: { farmId_userId: { farmId: invite.farmId, userId } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('You are already a member of this farm');
    }

    // Enforce the plan's team-seat ceiling before adding (RAKHAL-219).
    const memberCount = await this.prisma.farmMember.count({
      where: { farmId: invite.farmId },
    });
    await this.subscriptionAccess.assertMemberSeatAvailable(
      invite.farmId,
      memberCount,
    );

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
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
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

  private mapPurpose(purpose?: string): ShedPurpose | undefined {
    if (!purpose) return undefined;
    const upper = purpose.toUpperCase();
    return (Object.values(ShedPurpose) as string[]).includes(upper)
      ? (upper as ShedPurpose)
      : ShedPurpose.GENERAL;
  }
}
