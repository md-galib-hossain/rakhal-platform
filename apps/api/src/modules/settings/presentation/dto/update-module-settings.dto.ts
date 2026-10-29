import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** `PATCH /settings/modules` (RAKHAL-032). Any subset of any module's fields. */

class CattleModuleDto {
  @IsOptional() @IsString() @MaxLength(40) id_format?: string;
  @IsOptional() @IsString() @MaxLength(20) tag_prefix?: string;
  @IsOptional() @IsString() @MaxLength(20) avg_daily_milk_target_range?: string;
}

class MilkModuleDto {
  // active_sessions moved to its own owner-only endpoint — see
  // `update-milk-sessions.dto.ts` / `PATCH /settings/modules/milk-sessions`.

  @IsOptional() @IsString() @MaxLength(5) morning_start?: string;
  @IsOptional() @IsString() @MaxLength(5) morning_end?: string;
  @IsOptional() @IsString() @MaxLength(5) noon_start?: string;
  @IsOptional() @IsString() @MaxLength(5) noon_end?: string;
  @IsOptional() @IsString() @MaxLength(5) evening_start?: string;
  @IsOptional() @IsString() @MaxLength(5) evening_end?: string;
  @IsOptional() @IsString() @MaxLength(5) night_start?: string;
  @IsOptional() @IsString() @MaxLength(5) night_end?: string;
  @IsOptional() @IsIn(['litres', 'kg']) milk_unit?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) anomaly_threshold_pct?: number;
  @IsOptional() @IsInt() @Min(0) @Max(30) colostrum_window_days?: number;
}

class ReproductionModuleDto {
  @IsOptional() @IsInt() @Min(0) @Max(365) vwp_days?: number;
  @IsOptional() @IsInt() @Min(1) @Max(120) pregnancy_check_days?: number;
  @IsOptional()
  @IsInt()
  @Min(200)
  @Max(600)
  target_calving_interval_days?: number;
  @IsOptional() @IsInt() @Min(0) @Max(180) dry_period_target_days?: number;
}

class FinanceModuleDto {
  @IsOptional() @IsString() @MaxLength(10) currency?: string;
  @IsOptional() @IsString() @MaxLength(5) currency_symbol?: string;
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  survival_runway_warning_days?: number;
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  survival_runway_critical_days?: number;
  @IsOptional() @IsInt() @Min(1) @Max(12) financial_year_start_month?: number;
}

class HealthModuleDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  herd_health_score_warning_pct?: number;
  @IsOptional() @IsInt() @Min(0) scc_alert_threshold?: number;
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  morbidity_outbreak_threshold_pct?: number;
}

export class UpdateModuleSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CattleModuleDto)
  cattle?: CattleModuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MilkModuleDto)
  milk?: MilkModuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReproductionModuleDto)
  reproduction?: ReproductionModuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FinanceModuleDto)
  finance?: FinanceModuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => HealthModuleDto)
  health?: HealthModuleDto;
}
