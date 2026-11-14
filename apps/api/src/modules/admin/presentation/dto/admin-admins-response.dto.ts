import { ApiProperty } from '@nestjs/swagger';
import { PlatformAdminRole } from '@prisma/client';
import type { CursorPage } from 'src/common/pagination/cursor-page.type';
import type { AdminManagementService } from '../../application/services/admin-management.service';

/**
 * Documented response shapes for the platform-admin management routes (`/admin/admins`, admin-api, RD-140).
 * Each class mirrors what `AdminManagementService` returns and is pinned to it by a compile-time guard at the
 * bottom of this file. `Date` fields are ISO-8601 strings on the wire. Credentials never appear here: the
 * service strips them (`SafeAdmin`); the only secret returned is the one-time temporary password.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;

/** A platform admin without credentials. */
export class AdminAccountDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: PlatformAdminRole, enumName: 'PlatformAdminRole' })
  role!: PlatformAdminRole;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() totpEnabled!: boolean;
  @ApiProperty() mustChangePassword!: boolean;
  @ApiProperty({ ...DATE_TIME, nullable: true })
  passwordChangedAt!: Date | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) lastLoginAt!: Date | null;
  @ApiProperty({ type: String, nullable: true }) lastLoginIp!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

/** POST /admin/admins and POST /admin/admins/:id/reset-password. */
export class AdminTemporaryPasswordResponseDto {
  @ApiProperty({ type: () => AdminAccountDto }) admin!: AdminAccountDto;
  @ApiProperty({
    description:
      'Shown once. The admin must change it at first sign-in (`mustChangePassword`).',
  })
  temporaryPassword!: string;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Ret<K extends keyof AdminManagementService> =
  AdminManagementService[K] extends (...args: never[]) => infer R
    ? Awaited<R>
    : never;

export type AdminAdminsShapeGuards = [
  Assert<Same<Ret<'list'>, CursorPage<AdminAccountDto>>>,
  Assert<Same<Ret<'get'>, AdminAccountDto>>,
  Assert<Same<Ret<'create'>, AdminTemporaryPasswordResponseDto>>,
  Assert<Same<Ret<'update'>, AdminAccountDto>>,
  Assert<Same<Ret<'deactivate'>, AdminAccountDto>>,
  Assert<Same<Ret<'activate'>, AdminAccountDto>>,
  Assert<Same<Ret<'resetTwoFactor'>, AdminAccountDto>>,
  Assert<Same<Ret<'resetPassword'>, AdminTemporaryPasswordResponseDto>>,
];
