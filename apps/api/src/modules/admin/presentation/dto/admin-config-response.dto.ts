import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import type { AdminPlatformConfigService } from '../../application/services/admin-platform-config.service';

/**
 * Documented response shapes for admin feature flags and platform settings (`/admin/config/*`, admin-api,
 * RD-140). Each class mirrors what `AdminPlatformConfigService` returns and is pinned to it by a compile-time
 * guard at the bottom of this file. `Date` fields are ISO-8601 strings on the wire.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;

/** A feature flag (GET list rows, POST create, PATCH update). */
export class AdminFeatureFlagDto {
  @ApiProperty() id!: string;
  @ApiProperty() key!: string;
  @ApiProperty() description!: string;
  @ApiProperty() enabled!: boolean;
  @ApiProperty({
    type: [String],
    description: 'Farm ids the flag is targeted at (empty = no targeting).',
  })
  farmIds!: string[];
  @ApiProperty({ type: String, nullable: true }) updatedById!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

/** DELETE /admin/config/flags/:key. */
export class AdminFlagDeletedResponseDto {
  @ApiProperty() key!: string;
  @ApiProperty() deleted!: boolean;
}

/** A platform setting (GET list rows, PUT set). */
export class AdminPlatformSettingDto {
  @ApiProperty() key!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: String, nullable: true }) updatedById!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
  @ApiProperty({
    nullable: true,
    description:
      'Free-form JSON value of the setting (any JSON type, or null).',
  })
  value!: Prisma.JsonValue;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Cfg<K extends keyof AdminPlatformConfigService> =
  AdminPlatformConfigService[K] extends (...args: never[]) => infer R
    ? Awaited<R>
    : never;

export type AdminConfigShapeGuards = [
  Assert<Same<Cfg<'listFlags'>, AdminFeatureFlagDto[]>>,
  Assert<Same<Cfg<'createFlag'>, AdminFeatureFlagDto>>,
  Assert<Same<Cfg<'updateFlag'>, AdminFeatureFlagDto>>,
  Assert<Same<Cfg<'deleteFlag'>, AdminFlagDeletedResponseDto>>,
  Assert<Same<Cfg<'listSettings'>, AdminPlatformSettingDto[]>>,
  Assert<Same<Cfg<'setSetting'>, AdminPlatformSettingDto>>,
];
