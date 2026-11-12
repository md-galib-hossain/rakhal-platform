import { ApiProperty } from '@nestjs/swagger';
import type { CursorPage } from 'src/common/pagination/cursor-page.type';
import type { FeedRequirementsService } from '../../application/services/feed-requirements.service';
import type { RequirementOverrideService } from '../../application/services/requirement-override.service';
import type {
  RequirementSettingSource,
  RequirementSettingsService,
} from '../../application/services/requirement-settings.service';
import type {
  RequirementSettingField,
  RequirementSettings,
} from '../../domain/requirement-settings';
import { RequirementOverrideEndReason, type Prisma } from '@prisma/client';

/**
 * Documented response shapes for the requirement-settings, today-requirement and requirement-override
 * history routes (RD-140). Each class mirrors what its service returns and is pinned to it by a compile-time
 * guard at the bottom of this file. Keys are snake_case where the service builds them by hand. `Date` fields
 * are ISO-8601 strings on the wire; quantities are plain JSON numbers.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;
const NULLABLE_NUMBER = { type: Number, nullable: true } as const;
const NULLABLE_STRING = { type: String, nullable: true } as const;

// --- Requirement settings (GET / PUT / DELETE /feed/requirement-settings) ------------------------------

export class PregnancyIntakeStageDto {
  @ApiProperty({
    description: 'Upper bound of the band, in days of gestation (inclusive).',
  })
  untilDay!: number;
  @ApiProperty({
    description: 'Target intake for the band as a fraction of body weight.',
  })
  percentOfBodyWeight!: number;
}

/** Every tuning number of the requirement engine. */
export class RequirementSettingsDto {
  @ApiProperty() maintenanceEnergyPerMetabolicKg!: number;
  @ApiProperty() energyPerLitreMilk!: number;
  @ApiProperty() energyPerMilkFatPercent!: number;
  @ApiProperty() netEnergyEfficiency!: number;
  @ApiProperty() maintenanceProteinPerMetabolicKg!: number;
  @ApiProperty() proteinPerLitreMilk!: number;
  @ApiProperty() degradableProteinShare!: number;
  @ApiProperty() undegradableProteinShare!: number;
  @ApiProperty() intakeFromMilkFactor!: number;
  @ApiProperty() intakeFromBodyWeightFactor!: number;
  @ApiProperty() intakeCurveSteepness!: number;
  @ApiProperty() intakeCurveOffset!: number;
  @ApiProperty() defaultDaysInMilk!: number;
  @ApiProperty() defaultWeightKg!: number;
  @ApiProperty() alertDryMatterBelowPct!: number;
  @ApiProperty() alertDryMatterAbovePct!: number;
  @ApiProperty() alertProteinBelowPct!: number;
  @ApiProperty() alertProteinAbovePct!: number;
  @ApiProperty() alertEnergyBelowPct!: number;
  @ApiProperty() alertEnergyAbovePct!: number;
  @ApiProperty() manualOverrideDriftPct!: number;
  @ApiProperty() lookaheadDays!: number;
  @ApiProperty({ type: () => [PregnancyIntakeStageDto] })
  pregnancyIntakeStages!: PregnancyIntakeStageDto[];
  @ApiProperty() pregnancyLengthDays!: number;
  @ApiProperty() pregnancyPeakEnergy!: number;
  @ApiProperty() pregnancyPeakProtein!: number;
  @ApiProperty() heiferIntakePercentOfBodyWeight!: number;
  @ApiProperty() heiferGrowthEnergy!: number;
  @ApiProperty() heiferGrowthProtein!: number;
  @ApiProperty() targetBodyCondition!: number;
  @ApiProperty() energyAdjustPerBodyConditionStep!: number;
  @ApiProperty() intakeAdjustPerBodyConditionPoint!: number;
  @ApiProperty() tdnShareOfIntake!: number;
  @ApiProperty() adfShareOfIntake!: number;
  @ApiProperty() ndfMinShareOfIntake!: number;
  @ApiProperty() ndfMaxShareOfIntake!: number;
  @ApiProperty() fatShareOfIntake!: number;
  @ApiProperty() calciumPerBodyWeightKg!: number;
  @ApiProperty() calciumPerLitreMilk!: number;
  @ApiProperty() phosphorusPerBodyWeightKg!: number;
  @ApiProperty() phosphorusPerLitreMilk!: number;
  @ApiProperty() calciumToPhosphorusTarget!: number;
}

/** The farm's own overrides: any subset of the settings. */
export class RequirementSettingsChangesDto {
  @ApiProperty({ required: false, type: Number })
  maintenanceEnergyPerMetabolicKg?: number;
  @ApiProperty({ required: false, type: Number }) energyPerLitreMilk?: number;
  @ApiProperty({ required: false, type: Number })
  energyPerMilkFatPercent?: number;
  @ApiProperty({ required: false, type: Number }) netEnergyEfficiency?: number;
  @ApiProperty({ required: false, type: Number })
  maintenanceProteinPerMetabolicKg?: number;
  @ApiProperty({ required: false, type: Number }) proteinPerLitreMilk?: number;
  @ApiProperty({ required: false, type: Number })
  degradableProteinShare?: number;
  @ApiProperty({ required: false, type: Number })
  undegradableProteinShare?: number;
  @ApiProperty({ required: false, type: Number }) intakeFromMilkFactor?: number;
  @ApiProperty({ required: false, type: Number })
  intakeFromBodyWeightFactor?: number;
  @ApiProperty({ required: false, type: Number }) intakeCurveSteepness?: number;
  @ApiProperty({ required: false, type: Number }) intakeCurveOffset?: number;
  @ApiProperty({ required: false, type: Number }) defaultDaysInMilk?: number;
  @ApiProperty({ required: false, type: Number }) defaultWeightKg?: number;
  @ApiProperty({ required: false, type: Number })
  alertDryMatterBelowPct?: number;
  @ApiProperty({ required: false, type: Number })
  alertDryMatterAbovePct?: number;
  @ApiProperty({ required: false, type: Number }) alertProteinBelowPct?: number;
  @ApiProperty({ required: false, type: Number }) alertProteinAbovePct?: number;
  @ApiProperty({ required: false, type: Number }) alertEnergyBelowPct?: number;
  @ApiProperty({ required: false, type: Number }) alertEnergyAbovePct?: number;
  @ApiProperty({ required: false, type: Number })
  manualOverrideDriftPct?: number;
  @ApiProperty({ required: false, type: Number }) lookaheadDays?: number;
  @ApiProperty({ required: false, type: () => [PregnancyIntakeStageDto] })
  pregnancyIntakeStages?: PregnancyIntakeStageDto[];
  @ApiProperty({ required: false, type: Number }) pregnancyLengthDays?: number;
  @ApiProperty({ required: false, type: Number }) pregnancyPeakEnergy?: number;
  @ApiProperty({ required: false, type: Number }) pregnancyPeakProtein?: number;
  @ApiProperty({ required: false, type: Number })
  heiferIntakePercentOfBodyWeight?: number;
  @ApiProperty({ required: false, type: Number }) heiferGrowthEnergy?: number;
  @ApiProperty({ required: false, type: Number }) heiferGrowthProtein?: number;
  @ApiProperty({ required: false, type: Number }) targetBodyCondition?: number;
  @ApiProperty({ required: false, type: Number })
  energyAdjustPerBodyConditionStep?: number;
  @ApiProperty({ required: false, type: Number })
  intakeAdjustPerBodyConditionPoint?: number;
  @ApiProperty({ required: false, type: Number }) tdnShareOfIntake?: number;
  @ApiProperty({ required: false, type: Number }) adfShareOfIntake?: number;
  @ApiProperty({ required: false, type: Number }) ndfMinShareOfIntake?: number;
  @ApiProperty({ required: false, type: Number }) ndfMaxShareOfIntake?: number;
  @ApiProperty({ required: false, type: Number }) fatShareOfIntake?: number;
  @ApiProperty({ required: false, type: Number })
  calciumPerBodyWeightKg?: number;
  @ApiProperty({ required: false, type: Number }) calciumPerLitreMilk?: number;
  @ApiProperty({ required: false, type: Number })
  phosphorusPerBodyWeightKg?: number;
  @ApiProperty({ required: false, type: Number })
  phosphorusPerLitreMilk?: number;
  @ApiProperty({ required: false, type: Number })
  calciumToPhosphorusTarget?: number;
}

export class RequirementSettingFieldDto {
  @ApiProperty({
    enum: [
      'energy',
      'protein',
      'intake',
      'alerts',
      'pregnancy',
      'heifer',
      'bodyCondition',
      'mineralsAndFibre',
    ],
  })
  group!: RequirementSettingField['group'];
  @ApiProperty() label!: string;
  @ApiProperty({
    description: 'Unit shown as helper text; empty for dimensionless factors.',
  })
  unit!: string;
  @ApiProperty({ description: 'Inclusive lower bound.' }) min!: number;
  @ApiProperty({ description: 'Inclusive upper bound.' }) max!: number;
}

export class RequirementPresetRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() version!: number;
  @ApiProperty(DATE_TIME) effective_from!: Date;
}

export class RequirementSettingsResponseDto {
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
  sources!: Record<string, RequirementSettingSource>;
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      $ref: '#/components/schemas/RequirementSettingFieldDto',
    },
    description:
      'Editor metadata (group, label, unit, bounds) keyed by setting name.',
  })
  fields!: Record<
    Exclude<keyof RequirementSettings, 'pregnancyIntakeStages'>,
    RequirementSettingFieldDto
  >;
}

// --- Requirement profile + today's requirement (GET /feed/today-requirement) -----------------------------

export class RequirementDmPartsDto {
  @ApiProperty() lactation!: number;
  @ApiProperty() pregnancy!: number;
  @ApiProperty() heiferGrowth!: number;
  @ApiProperty() bcsAdjustment!: number;
}

export class RequirementEnergyPartsDto {
  @ApiProperty() maintenance!: number;
  @ApiProperty() milk!: number;
  @ApiProperty() pregnancy!: number;
  @ApiProperty() heiferGrowth!: number;
}

export class RequirementBreakdownDto {
  @ApiProperty({ type: () => RequirementDmPartsDto })
  dm!: RequirementDmPartsDto;
  @ApiProperty({ type: () => RequirementEnergyPartsDto })
  me!: RequirementEnergyPartsDto;
  @ApiProperty({ type: () => RequirementEnergyPartsDto })
  cp!: RequirementEnergyPartsDto;
}

/** One animal's (or the herd's) daily requirement. */
export class RequirementProfileDto {
  @ApiProperty() dm_kg!: number;
  @ApiProperty() cp_kg!: number;
  @ApiProperty() me_mj!: number;
  @ApiProperty() ndf_kg!: number;
  @ApiProperty() fat_kg!: number;
  @ApiProperty() ne_mcal!: number;
  @ApiProperty() energy_density_mj_per_kg_dm!: number;
  @ApiProperty() cp_pct_of_dm!: number;
  @ApiProperty() tdn_kg!: number;
  @ApiProperty(NULLABLE_NUMBER) calcium_kg!: number | null;
  @ApiProperty(NULLABLE_NUMBER) phosphorus_kg!: number | null;
  @ApiProperty() adf_kg!: number;
  @ApiProperty() rdp_pct!: number;
  @ApiProperty() rup_pct!: number;
  @ApiProperty() ndf_max_kg!: number;
  @ApiProperty() ca_p_ratio_target!: number;
  @ApiProperty({ type: () => RequirementBreakdownDto, nullable: true })
  breakdown!: RequirementBreakdownDto | null;
}

export class TodayRequirementIngredientDto {
  @ApiProperty() ingredient_id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() total_kg!: number;
}

export class TodayRequirementRationDto {
  @ApiProperty() plan_id!: string;
  @ApiProperty(NULLABLE_STRING) concentration_id!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty() headcount!: number;
  @ApiProperty() total_kg!: number;
}

export class TodayRequirementInputsDto {
  @ApiProperty() weight_kg!: number;
  @ApiProperty() milk_target_l!: number;
  @ApiProperty(NULLABLE_NUMBER) bcs!: number | null;
  @ApiProperty() cattle_with_weight!: number;
  @ApiProperty() cattle_with_milk_data!: number;
}

export class TodayRequirementDataSourceDto {
  @ApiProperty() weight!: string;
  @ApiProperty() milk_yield!: string;
}

export class TodayRequirementDetailDto {
  @ApiProperty() headcount!: number;
  @ApiProperty() manual_headcount!: number;
  @ApiProperty() ca_p_headcount!: number;
  @ApiProperty({ type: () => TodayRequirementInputsDto })
  inputs!: TodayRequirementInputsDto;
  @ApiProperty({ type: () => TodayRequirementDataSourceDto })
  data_source!: TodayRequirementDataSourceDto;
  @ApiProperty({ type: () => RequirementProfileDto })
  per_cow!: RequirementProfileDto;
  @ApiProperty({ type: () => RequirementProfileDto })
  herd_total!: RequirementProfileDto;
}

export class TodayRequirementResponseDto {
  @ApiProperty({ type: () => [TodayRequirementIngredientDto] })
  by_ingredient!: TodayRequirementIngredientDto[];
  @ApiProperty({ type: () => [TodayRequirementRationDto] })
  by_ration!: TodayRequirementRationDto[];
  @ApiProperty() grand_total_kg!: number;
  @ApiProperty({ type: () => TodayRequirementDetailDto, nullable: true })
  requirement!: TodayRequirementDetailDto | null;
  @ApiProperty() has_active_ration!: boolean;
}

// --- Requirement override history (GET /feed/cattle/:id/requirement-overrides) ----------------------------

export class RequirementOverrideRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() cattle_id!: string;
  @ApiProperty() dm_kg!: number;
  @ApiProperty() cp_kg!: number;
  @ApiProperty() me_mj!: number;
  @ApiProperty(NULLABLE_NUMBER) ndf_kg!: number | null;
  @ApiProperty(NULLABLE_NUMBER) ndf_max_kg!: number | null;
  @ApiProperty(NULLABLE_NUMBER) adf_kg!: number | null;
  @ApiProperty(NULLABLE_NUMBER) fat_kg!: number | null;
  @ApiProperty(NULLABLE_NUMBER) tdn_kg!: number | null;
  @ApiProperty(NULLABLE_NUMBER) calcium_kg!: number | null;
  @ApiProperty(NULLABLE_NUMBER) phosphorus_kg!: number | null;
  @ApiProperty(NULLABLE_NUMBER) rdp_pct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) rup_pct!: number | null;
  @ApiProperty(NULLABLE_STRING) note!: string | null;
  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description:
      'The calculated requirement at the moment the override was set (JSON).',
  })
  dynamic_snapshot!: Prisma.JsonValue;
  @ApiProperty(DATE_TIME) effective_from!: Date;
  @ApiProperty({ ...DATE_TIME, nullable: true }) effective_to!: Date | null;
  @ApiProperty({
    enum: RequirementOverrideEndReason,
    enumName: 'RequirementOverrideEndReason',
    nullable: true,
  })
  end_reason!: RequirementOverrideEndReason | null;
  @ApiProperty() set_by!: string;
  @ApiProperty(NULLABLE_STRING) set_by_name!: string | null;
  @ApiProperty(NULLABLE_STRING) ended_by!: string | null;
  @ApiProperty(NULLABLE_STRING) ended_by_name!: string | null;
}

// --- Compile-time guards (RD-140) -----------------------------------------------------------------------
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Awaited1<F> = F extends (...args: never[]) => infer R ? Awaited<R> : never;
type SettingsRet<K extends keyof RequirementSettingsService> = Awaited1<
  RequirementSettingsService[K]
>;

export type FeedRequirementShapeGuards = [
  Assert<Same<RequirementSettings, RequirementSettingsDto>>,
  Assert<Same<Partial<RequirementSettings>, RequirementSettingsChangesDto>>,
  Assert<Same<SettingsRet<'describe'>, RequirementSettingsResponseDto>>,
  Assert<Same<SettingsRet<'saveFarmChanges'>, RequirementSettingsResponseDto>>,
  Assert<Same<SettingsRet<'resetFarmChanges'>, RequirementSettingsResponseDto>>,
  Assert<
    Same<
      Awaited1<FeedRequirementsService['getTodaysRequirement']>,
      TodayRequirementResponseDto
    >
  >,
  Assert<
    Same<
      Awaited1<RequirementOverrideService['history']>,
      CursorPage<RequirementOverrideRowDto>
    >
  >,
];
