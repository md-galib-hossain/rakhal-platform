import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { RequirementSettingsChanges } from 'src/modules/feed/domain/requirement-settings';

/**
 * Create a requirement preset (RAKHAL-410, admin-api).
 *
 * As with the farm-facing DTO, the 33 individual settings are NOT re-declared here with
 * class-validator decorators — `domain/requirement-settings.ts` is the single source of
 * truth for their names, bounds and units, and duplicating them would guarantee drift.
 * `RequirementSettingsService` validates and returns a 400 naming every bad field.
 */
export class CreateRequirementPresetDto {
  @ApiProperty({ example: 'NRC-2001 baseline (Bangladesh)' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description:
      'The tuning numbers this preset supplies. Partial is allowed — anything absent falls through to the built-in defaults.',
    example: { proteinPerLitreMilk: 88, tdnShareOfIntake: 0.7 },
  })
  @IsObject()
  settings!: RequirementSettingsChanges;

  @ApiPropertyOptional({
    description:
      'When this preset is meant to take effect. Recorded for audit; activation is still an explicit step.',
  })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}

/** Amend a preset that has not been activated yet. An active preset is immutable. */
export class UpdateRequirementPresetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: { proteinPerLitreMilk: 88 } })
  @IsOptional()
  @IsObject()
  settings?: RequirementSettingsChanges;
}
