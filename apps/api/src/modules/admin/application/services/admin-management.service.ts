import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PlatformAdmin, PlatformAdminRole } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { PasswordService } from 'src/modules/auth/application/services/password.service';
import { generateTemporaryAdminPassword } from '../../domain/admin-password-policy';
import { ListAdminsQueryDto } from '../../presentation/dto/list-admins.dto';
import { AdminAuditService } from './admin-audit.service';
import { AdminSessionService } from './admin-session.service';

/** The admin fields that are safe to return — never the hash or TOTP secret. */
const SAFE_ADMIN_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  totpEnabled: true,
  mustChangePassword: true,
  passwordChangedAt: true,
  lastLoginAt: true,
  lastLoginIp: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlatformAdminSelect;

export type SafeAdmin = Prisma.PlatformAdminGetPayload<{
  select: typeof SAFE_ADMIN_SELECT;
}>;

function snapshot(admin: SafeAdmin | PlatformAdmin): Record<string, unknown> {
  return {
    email: admin.email,
    name: admin.name,
    role: admin.role,
    isActive: admin.isActive,
    totpEnabled: admin.totpEnabled,
    mustChangePassword: admin.mustChangePassword,
  };
}

/**
 * Platform-admin lifecycle (P2-05): create / update / (de)activate / MFA reset /
 * password reset. SUPER_ADMIN only (`admin.manage`). Guard rails: an admin can't
 * act on themselves for the lockout-prone operations, and the last active
 * SUPER_ADMIN can never be demoted or deactivated. Temporary passwords are
 * returned exactly once and force a change at next sign-in.
 */
@Injectable()
export class AdminManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: AdminSessionService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(query: ListAdminsQueryDto): Promise<CursorPage<SafeAdmin>> {
    const rows = await this.prisma.platformAdmin.findMany({
      select: SAFE_ADMIN_SELECT,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async get(id: string): Promise<SafeAdmin> {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id },
      select: SAFE_ADMIN_SELECT,
    });
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  async create(
    actorId: string,
    input: { email: string; name: string; role: PlatformAdminRole },
  ): Promise<{ admin: SafeAdmin; temporaryPassword: string }> {
    const temporaryPassword = generateTemporaryAdminPassword();
    let admin: SafeAdmin;
    try {
      admin = await this.prisma.platformAdmin.create({
        data: {
          email: input.email.trim().toLowerCase(),
          name: input.name.trim(),
          role: input.role,
          passwordHash: await this.passwords.hashPassword(temporaryPassword),
          mustChangePassword: true,
        },
        select: SAFE_ADMIN_SELECT,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('An admin with this email already exists');
      }
      throw err;
    }
    await this.audit.record({
      adminId: actorId,
      action: 'ADMIN_CREATED',
      entityType: 'PlatformAdmin',
      entityId: admin.id,
      after: snapshot(admin),
    });
    return { admin, temporaryPassword };
  }

  async update(
    actorId: string,
    id: string,
    input: { name?: string; role?: PlatformAdminRole },
  ): Promise<SafeAdmin> {
    const before = await this.getEntity(id);
    const roleChanges = input.role !== undefined && input.role !== before.role;

    if (roleChanges) {
      if (id === actorId) {
        throw new BadRequestException('You cannot change your own role');
      }
      if (before.role === 'SUPER_ADMIN') await this.assertNotLastSuper(id);
    }

    const admin = await this.prisma.platformAdmin.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
      },
      select: SAFE_ADMIN_SELECT,
    });
    await this.audit.record({
      adminId: actorId,
      action: roleChanges ? 'ADMIN_ROLE_CHANGED' : 'ADMIN_UPDATED',
      entityType: 'PlatformAdmin',
      entityId: id,
      before: snapshot(before),
      after: snapshot(admin),
    });
    return admin;
  }

  async deactivate(actorId: string, id: string): Promise<SafeAdmin> {
    if (id === actorId) {
      throw new BadRequestException('You cannot deactivate yourself');
    }
    const before = await this.getEntity(id);
    if (!before.isActive) return this.get(id);
    if (before.role === 'SUPER_ADMIN') await this.assertNotLastSuper(id);

    const admin = await this.prisma.platformAdmin.update({
      where: { id },
      data: { isActive: false },
      select: SAFE_ADMIN_SELECT,
    });
    // The guard already rejects an inactive admin; revoking the sessions as well
    // means reactivation never resurrects an old token.
    await this.sessions.revokeAll(id, 'ADMIN_DEACTIVATED');
    await this.audit.record({
      adminId: actorId,
      action: 'ADMIN_DEACTIVATED',
      entityType: 'PlatformAdmin',
      entityId: id,
      before: snapshot(before),
      after: snapshot(admin),
    });
    return admin;
  }

  async activate(actorId: string, id: string): Promise<SafeAdmin> {
    const before = await this.getEntity(id);
    if (before.isActive) return this.get(id);
    const admin = await this.prisma.platformAdmin.update({
      where: { id },
      data: { isActive: true },
      select: SAFE_ADMIN_SELECT,
    });
    await this.audit.record({
      adminId: actorId,
      action: 'ADMIN_ACTIVATED',
      entityType: 'PlatformAdmin',
      entityId: id,
      before: snapshot(before),
      after: snapshot(admin),
    });
    return admin;
  }

  /** Lost authenticator: clear TOTP so the admin must re-enrol at next sign-in. */
  async resetTwoFactor(actorId: string, id: string): Promise<SafeAdmin> {
    if (id === actorId) {
      throw new BadRequestException('You cannot reset your own 2FA');
    }
    const before = await this.getEntity(id);
    const admin = await this.prisma.platformAdmin.update({
      where: { id },
      data: { totpEnabled: false, totpSecret: null },
      select: SAFE_ADMIN_SELECT,
    });
    await this.sessions.revokeAll(id, 'TWO_FACTOR_RESET');
    await this.audit.record({
      adminId: actorId,
      action: 'TWO_FACTOR_RESET',
      entityType: 'PlatformAdmin',
      entityId: id,
      before: snapshot(before),
      after: snapshot(admin),
    });
    return admin;
  }

  /** Issues a new one-time password and ends all of the admin's sessions. */
  async resetPassword(
    actorId: string,
    id: string,
  ): Promise<{ admin: SafeAdmin; temporaryPassword: string }> {
    if (id === actorId) {
      throw new BadRequestException(
        'Use change-password to change your own password',
      );
    }
    const before = await this.getEntity(id);
    const temporaryPassword = generateTemporaryAdminPassword();
    const admin = await this.prisma.platformAdmin.update({
      where: { id },
      data: {
        passwordHash: await this.passwords.hashPassword(temporaryPassword),
        mustChangePassword: true,
      },
      select: SAFE_ADMIN_SELECT,
    });
    await this.sessions.revokeAll(id, 'PASSWORD_RESET');
    await this.audit.record({
      adminId: actorId,
      action: 'PASSWORD_RESET',
      entityType: 'PlatformAdmin',
      entityId: id,
      before: snapshot(before),
      after: snapshot(admin),
    });
    return { admin, temporaryPassword };
  }

  private async getEntity(id: string): Promise<PlatformAdmin> {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  /** Refuses when `id` is the only active SUPER_ADMIN left. */
  private async assertNotLastSuper(id: string): Promise<void> {
    const others = await this.prisma.platformAdmin.count({
      where: { role: 'SUPER_ADMIN', isActive: true, id: { not: id } },
    });
    if (others === 0) {
      throw new ConflictException(
        'At least one active SUPER_ADMIN must remain',
      );
    }
  }
}
