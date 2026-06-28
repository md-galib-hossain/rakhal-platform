import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { AuditService } from 'src/modules/audit/application/services/audit.service';
import {
  SYSTEM_ROLES,
  SystemRoleName,
} from 'src/modules/permission/domain/permission-catalogue';
import {
  buildCatalogue,
  invalidKeys,
  toMatrix,
} from '../../domain/permission-matrix';
import { CreateRoleDto } from '../../presentation/dto/create-role.dto';
import { UpdateRolePermissionsDto } from '../../presentation/dto/update-role-permissions.dto';

const BASE_ROLE_NAME: Record<'owner' | 'manager' | 'worker', SystemRoleName> = {
  owner: SYSTEM_ROLES.OWNER,
  manager: SYSTEM_ROLES.MANAGER,
  worker: SYSTEM_ROLES.WORKER,
};

/**
 * Roles & Permissions editor (RAKHAL-031, PRD §21.4 / §26).
 *
 * System roles (Owner/Manager/Worker) are global templates (`farmId = null`)
 * shared by every tenant, so they are **read-only** here — editing one would
 * change permissions for all farms. To customise, a farm owner creates a
 * farm-scoped custom role (optionally seeded from a base system role) and edits
 * that. All mutations are Owner-only (`settings.roles-manage`) and audited; the
 * permission cache is invalidated for every affected member.
 */
@Injectable()
export class RolesService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly audit: AuditService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(RolesService.name);
  }

  /** The grantable permission catalogue, grouped by resource. */
  getCatalogue() {
    return { permissions: buildCatalogue() };
  }

  /** List system templates + this farm's custom roles, each with its grant matrix. */
  async listRoles(farmId: string) {
    const roles = await this.prisma.role.findMany({
      where: {
        OR: [{ farmId }, { farmId: null, isSystemRole: true }],
      },
      include: {
        permissions: { select: { permission: { select: { key: true } } } },
        _count: { select: { members: { where: { farmId } } } },
      },
      orderBy: [{ isSystemRole: 'desc' }, { name: 'asc' }],
    });

    return {
      roles: roles.map((r) => {
        const keys = r.permissions
          .map((p) => p.permission.key)
          .sort((a, b) => a.localeCompare(b));
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          is_system: r.isSystemRole,
          editable: !r.isSystemRole,
          member_count: r._count.members,
          permission_keys: keys,
          matrix: toMatrix(keys),
        };
      }),
      catalogue: buildCatalogue(),
    };
  }

  /** Create a farm-scoped custom role, inheriting a base role unless explicit keys are given. */
  async createRole(farmId: string, userId: string, dto: CreateRoleDto) {
    if (this.isSystemRoleName(dto.name)) {
      throw new ConflictException(
        `"${dto.name}" is a reserved system role name`,
      );
    }

    const keys = dto.permission_keys
      ? this.validateKeys(dto.permission_keys)
      : await this.baseRoleKeys(dto.base_role ?? 'worker');

    const permissionIds = await this.keysToIds(keys);

    try {
      const role = await this.prisma.role.create({
        data: {
          farmId,
          name: dto.name,
          description: dto.description,
          isSystemRole: false,
          permissions: {
            create: permissionIds.map((permissionId) => ({ permissionId })),
          },
        },
      });

      await this.audit.record({
        actorUserId: userId,
        action: AuditAction.ROLE_CREATED,
        entityType: 'Role',
        entityId: role.id,
        farmId,
        metadata: { name: role.name, permission_keys: keys },
      });

      this.log.info('Custom role created', { roleId: role.id, farmId });
      return this.detail(farmId, role.id);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          `A role named "${dto.name}" already exists`,
        );
      }
      throw e;
    }
  }

  /** Replace a custom role's grant set. System roles are read-only. */
  async updateRolePermissions(
    farmId: string,
    userId: string,
    roleId: string,
    dto: UpdateRolePermissionsDto,
  ) {
    const role = await this.getCustomRoleOrThrow(farmId, roleId);
    const keys = this.validateKeys(dto.permission_keys);
    const permissionIds = await this.keysToIds(keys);

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      }),
    ]);

    await this.invalidateMembers(farmId, roleId);

    await this.audit.record({
      actorUserId: userId,
      action: AuditAction.PERMISSION_UPDATED,
      entityType: 'Role',
      entityId: roleId,
      farmId,
      metadata: { name: role.name, permission_keys: keys },
    });

    this.log.info('Role permissions updated', { roleId, farmId });
    return this.detail(farmId, roleId);
  }

  /** Delete a custom role. Blocked while members are still assigned to it. */
  async deleteRole(farmId: string, userId: string, roleId: string) {
    const role = await this.getCustomRoleOrThrow(farmId, roleId);

    const memberCount = await this.prisma.farmMember.count({
      where: { roleId, farmId },
    });
    if (memberCount > 0) {
      throw new BadRequestException(
        `Cannot delete role — ${memberCount} member(s) are still assigned. Reassign them first.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.role.delete({ where: { id: roleId } }),
    ]);

    await this.audit.record({
      actorUserId: userId,
      action: AuditAction.ROLE_UPDATED,
      entityType: 'Role',
      entityId: roleId,
      farmId,
      metadata: { name: role.name, deleted: true },
    });

    this.log.info('Custom role deleted', { roleId, farmId });
    return { id: roleId, deleted: true };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async detail(farmId: string, roleId: string) {
    const { roles } = await this.listRoles(farmId);
    const role = roles.find((r) => r.id === roleId);
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  private async getCustomRoleOrThrow(farmId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [{ farmId }, { farmId: null, isSystemRole: true }],
      },
      select: { id: true, name: true, farmId: true, isSystemRole: true },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystemRole || role.farmId !== farmId) {
      throw new ForbiddenException(
        'System roles are read-only. Create a custom role to customise permissions.',
      );
    }
    return role;
  }

  private validateKeys(keys: string[]): string[] {
    const unknown = invalidKeys(keys);
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown permission key(s): ${unknown.join(', ')}`,
      );
    }
    return [...new Set(keys)];
  }

  private async baseRoleKeys(
    base: 'owner' | 'manager' | 'worker',
  ): Promise<string[]> {
    const name = BASE_ROLE_NAME[base];
    const role = await this.prisma.role.findFirst({
      where: { name, farmId: null, isSystemRole: true },
      select: {
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
    if (!role) {
      throw new BadRequestException(`Base role "${base}" is not available`);
    }
    return role.permissions.map((p) => p.permission.key);
  }

  private async keysToIds(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    const perms = await this.prisma.permission.findMany({
      where: { key: { in: keys } },
      select: { id: true },
    });
    if (perms.length !== new Set(keys).size) {
      throw new BadRequestException(
        'One or more permission keys are not registered',
      );
    }
    return perms.map((p) => p.id);
  }

  private async invalidateMembers(farmId: string, roleId: string) {
    const members = await this.prisma.farmMember.findMany({
      where: { roleId, farmId },
      select: { userId: true },
    });
    await Promise.all(
      members.map((m) =>
        this.permissionService.invalidateForFarm(m.userId, farmId),
      ),
    );
  }

  private isSystemRoleName(name: string): boolean {
    const lowered = name.trim().toLowerCase();
    return Object.values(SYSTEM_ROLES).some((r) => r.toLowerCase() === lowered);
  }
}
