import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { RequirementSettingsChanges } from '../../domain/requirement-settings';

/**
 * A farm's changes to the requirement model (RAKHAL-409).
 *
 * Only the fields the farm actually wants to change are sent; everything absent inherits
 * from the active preset, and failing that the built-in defaults.
 *
 * Field-level checking is deliberately NOT done with class-validator decorators here:
 * the setting names, bounds and units are one source of truth in
 * `domain/requirement-settings.ts`, and duplicating 33 `@Min`/`@Max` pairs into a DTO
 * would guarantee the two drift apart. `RequirementSettingsService.saveFarmChanges`
 * runs `validateSettings()` and returns a 400 listing every bad field at once, so a form
 * can mark them all in one round-trip.
 */
export class UpdateRequirementSettingsDto {
  @ApiProperty({
    description:
      'Sparse map of requirement settings to change, e.g. { "proteinPerLitreMilk": 90 }. Absent fields inherit.',
    example: { proteinPerLitreMilk: 90, targetBodyCondition: 3.25 },
  })
  @IsObject()
  changes!: RequirementSettingsChanges;

  @ApiPropertyOptional({
    description: 'Why this farm deviates from the standard model.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
