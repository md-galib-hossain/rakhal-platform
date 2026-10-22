import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FarmStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { AuthService } from 'src/modules/auth/application/services/auth.service';
import {
  AdminSendPasswordResetDto,
  AdminSupportActionDto,
} from '../../presentation/dto/admin-support-action.dto';
import { AdminAuditService } from './admin-audit.service';

/**
 * Controlled support operations (Phase 4). Every action:
 *  - needs a written `reason` (audited) and a `confirm` that equals the target's
 *    identifying text, verified here against the database;
 *  - is state-idempotent — asking for the state a target is already in returns
 *    `changed: false` and writes nothing, so a double-click or retry is harmless;
 *  - records before/after in the append-only admin audit trail.
 *
 * Enforcement is not re-implemented here: a non-ACTIVE farm is rejected by
 * `TenantAccessService` on every farm route, and a blocked user by `SessionGuard`
 * on every request — both take effect on the very next call.
 */
@Injectable()
export class AdminSupportActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly audit: AdminAuditService,
  ) {}

  // ---------------------------------------------------------------- farms

  suspendFarm(actorId: string, id: string, dto: AdminSupportActionDto) {
    return this.setFarmStatus(actorId, id, dto, 'SUSPENDED');
  }

  reactivateFarm(actorId: string, id: string, dto: AdminSupportActionDto) {
    return this.setFarmStatus(actorId, id, dto, 'ACTIVE');
  }

  private async setFarmStatus(
    actorId: string,
    id: string,
    dto: AdminSupportActionDto,
    target: 'SUSPENDED' | 'ACTIVE',
  ) {
    const farm = await this.prisma.farm.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, status: true },
    });
    if (!farm) throw new NotFoundException('Farm not found');
    this.assertConfirm(dto.confirm, farm.name, 'farm name');

    if (farm.status === FarmStatus.ARCHIVED) {
      throw new ConflictException('An archived farm cannot be changed');
    }
    if (farm.status === target)
      return { id, status: farm.status, changed: false };

    await this.prisma.farm.update({ where: { id }, data: { status: target } });
    await this.audit.record({
      adminId: actorId,
      action: target === 'SUSPENDED' ? 'FARM_SUSPENDED' : 'FARM_REACTIVATED',
      entityType: 'Farm',
      entityId: id,
      before: { status: farm.status },
      after: { status: target },
      metadata: { reason: dto.reason, farmName: farm.name },
    });
    return { id, status: target, changed: true };
  }

  // ---------------------------------------------------------------- users

  async blockUser(actorId: string, id: string, dto: AdminSupportActionDto) {
    const user = await this.getUser(id);
    this.assertConfirm(dto.confirm, user.email, 'user email');
    if (user.isBlocked) return { id, isBlocked: true, changed: false };

    await this.prisma.user.update({
      where: { id },
      data: { isBlocked: true },
    });
    // SessionGuard already rejects a blocked user's next request; revoking the
    // sessions as well means unblocking later never resurrects an old token.
    const revoked = await this.auth.logoutAllSessions(id);
    await this.audit.record({
      adminId: actorId,
      action: 'USER_BLOCKED',
      entityType: 'User',
      entityId: id,
      before: { isBlocked: false },
      after: { isBlocked: true },
      metadata: {
        reason: dto.reason,
        email: user.email,
        revokedSessions: revoked.revokedSessions,
      },
    });
    return { id, isBlocked: true, changed: true };
  }

  async unblockUser(actorId: string, id: string, dto: AdminSupportActionDto) {
    const user = await this.getUser(id);
    this.assertConfirm(dto.confirm, user.email, 'user email');
    if (!user.isBlocked) return { id, isBlocked: false, changed: false };

    await this.prisma.user.update({
      where: { id },
      // Also clear any lockout so the user can actually sign in again.
      data: { isBlocked: false, failedLoginAttempts: 0, lockedUntil: null },
    });
    await this.audit.record({
      adminId: actorId,
      action: 'USER_UNBLOCKED',
      entityType: 'User',
      entityId: id,
      before: { isBlocked: true },
      after: { isBlocked: false },
      metadata: { reason: dto.reason, email: user.email },
    });
    return { id, isBlocked: false, changed: true };
  }

  /**
   * Sends the user a password-reset email through the normal self-service flow
   * (the admin never sees or sets a password). Optionally signs them out everywhere.
   */
  async sendPasswordReset(
    actorId: string,
    id: string,
    dto: AdminSendPasswordResetDto,
  ) {
    const user = await this.getUser(id);
    this.assertConfirm(dto.confirm, user.email, 'user email');

    await this.auth.forgotPassword(user.email);
    let revokedSessions = 0;
    if (dto.revokeSessions) {
      revokedSessions = (await this.auth.logoutAllSessions(id)).revokedSessions;
    }
    await this.audit.record({
      adminId: actorId,
      action: 'USER_PASSWORD_RESET_SENT',
      entityType: 'User',
      entityId: id,
      metadata: {
        reason: dto.reason,
        email: user.email,
        revokeSessions: !!dto.revokeSessions,
        revokedSessions,
      },
    });
    return { id, sent: true, revokedSessions };
  }

  async revokeUserSessions(
    actorId: string,
    id: string,
    dto: AdminSupportActionDto,
  ) {
    const user = await this.getUser(id);
    this.assertConfirm(dto.confirm, user.email, 'user email');

    const result = await this.auth.logoutAllSessions(id);
    await this.audit.record({
      adminId: actorId,
      action: 'USER_SESSIONS_REVOKED',
      entityType: 'User',
      entityId: id,
      metadata: {
        reason: dto.reason,
        email: user.email,
        revokedSessions: result.revokedSessions,
        revokedRefreshTokens: result.revokedRefreshTokens,
      },
    });
    return result;
  }

  // -------------------------------------------------------------- helpers

  private async getUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, email: true, isBlocked: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private assertConfirm(provided: string, expected: string, what: string) {
    if (provided.trim() !== expected) {
      throw new BadRequestException(`Confirmation does not match the ${what}`);
    }
  }
}
