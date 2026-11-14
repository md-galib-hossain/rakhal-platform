import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import type { RequirementSettings } from 'src/modules/feed/domain/requirement-settings';
import type { RequirementSettingsService } from 'src/modules/feed/application/services/requirement-settings.service';
import {
  RequirementPresetRefDto,
  RequirementSettingFieldDto,
  RequirementSettingsChangesDto,
  RequirementSettingsDto,
} from 'src/modules/feed/presentation/dto/feed-requirement-response.dto';

/**
 * Documented response shapes for admin requirement presets (`/admin/requirement-presets*`, admin-api, RD-140).
 * Each class mirrors what `RequirementSettingsService` returns and is pinned to it by a compile-time guard at
 * the bottom of this file. The settings/field DTOs are shared with the farm-side `GET /feed/requirement-settings`.
 * `Date` fields are ISO-8601 strings on the wire.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;

type ScalarSettingKey = Exclude<
  keyof RequirementSettings,
  'pregnancyIntakeStages'
>;

const FIELDS_META = {
  type: 'object',
  additionalProperties: {
    $ref: '#/components/schemas/RequirementSettingFieldDto',
  },
  description:
    'Editor metadata (group, label, unit, bounds) keyed by setting name.',
} as const;

/** A requirement preset version (list rows, create, update, activate). */
export class AdminRequirementPresetDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({
    description: 'Monotonic version; presets are immutable once active.',
  })
  version!: number;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The overrides this preset stores on top of the built-in defaults (free-form JSON).',
  })
  settings!: unknown;
  @ApiProperty({
    type: () => RequirementSettingsDto,
    description: 'The built-in defaults with this preset applied.',
  })
  effective!: RequirementSettingsDto;
  @ApiProperty() is_active!: boolean;
  @ApiProperty(DATE_TIME) effective_from!: Date;
  @ApiProperty({ type: String, nullable: true })
  created_by_admin_id!: string | null;
  @ApiProperty(DATE_TIME) created_at!: Date;
}

/** GET /admin/requirement-presets: every preset, the built-in defaults and field metadata for diffing. */
@ApiExtraModels(RequirementSettingFieldDto)
export class AdminRequirementPresetListResponseDto {
  @ApiProperty({ type: () => [AdminRequirementPresetDto] })
  presets!: AdminRequirementPresetDto[];
  @ApiProperty({ type: () => RequirementSettingsDto })
  built_in_defaults!: RequirementSettingsDto;
  @ApiProperty(FIELDS_META)
  fields!: Record<ScalarSettingKey, RequirementSettingFieldDto>;
}

/** GET /admin/requirement-presets/farms/:farmId: what one farm changed on top of the active preset. */
@ApiExtraModels(RequirementSettingFieldDto)
export class AdminFarmRequirementSettingsResponseDto {
  @ApiProperty({ type: () => RequirementSettingsDto })
  effective!: RequirementSettingsDto;
  @ApiProperty({ type: () => RequirementSettingsDto })
  defaults!: RequirementSettingsDto;
  @ApiProperty({ type: () => RequirementPresetRefDto, nullable: true })
  preset!: RequirementPresetRefDto | null;
  @ApiProperty({ type: () => RequirementSettingsChangesDto })
  farm_changes!: RequirementSettingsChangesDto;
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'string',
      enum: ['farm', 'preset', 'default'],
    },
    description: 'Which layer supplied each setting, keyed by setting name.',
  })
  sources!: Record<string, 'farm' | 'preset' | 'default'>;
  @ApiProperty(FIELDS_META)
  fields!: Record<ScalarSettingKey, RequirementSettingFieldDto>;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Set<K extends keyof RequirementSettingsService> =
  RequirementSettingsService[K] extends (...args: never[]) => infer R
    ? Awaited<R>
    : never;

export type AdminRequirementPresetShapeGuards = [
  Assert<Same<Set<'listPresets'>, AdminRequirementPresetListResponseDto>>,
  Assert<Same<Set<'createPreset'>, AdminRequirementPresetDto>>,
  Assert<Same<Set<'updatePreset'>, AdminRequirementPresetDto>>,
  Assert<Same<Set<'activatePreset'>, AdminRequirementPresetDto>>,
  Assert<
    Same<Set<'farmSettingsForAdmin'>, AdminFarmRequirementSettingsResponseDto>
  >,
];
