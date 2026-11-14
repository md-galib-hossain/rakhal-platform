import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  AppetiteStatus,
  BreedingMethod,
  HealthCareType,
  HealthCondition,
  HealthPriority,
} from '@prisma/client';
import { trimString } from './common.dto';

/**
 * RAKHAL-307: "she is already pregnant" declared at intake. At least one of
 * `conceptionDate`/`expectedCalvingDate` is required — `CattleService.create()`
 * derives whichever is missing the same way `createPregnancyDiagnosis` does
 * (conception + 280 days, or expected-calving as the anchor). Becomes a
 * synthetic `PregnancyDiagnosis` (`method: PURCHASE_INTAKE`) + its `Pregnancy`,
 * not a bare `Pregnancy` row, so it's editable via RAKHAL-305 and shows in the
 * events feed.
 */
export class IntakePregnancyDto {
  @ValidateIf((o: IntakePregnancyDto) => !o.expectedCalvingDate)
  @IsDateString()
  conceptionDate?: string;

  @ValidateIf((o: IntakePregnancyDto) => !o.conceptionDate)
  @IsDateString()
  expectedCalvingDate?: string;
}

/**
 * RAKHAL-307: "she is already milking" declared at intake — mirrors
 * `CreatePurchasedLactationDto`'s fields exactly so `CattleService.create()`
 * can reuse `createPurchasedLactation`'s start-date precedence (DIM >
 * estimated calving date > now).
 */
export class IntakeLactationDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  estimatedDaysInMilk?: number;

  @IsOptional()
  @IsDateString()
  estimatedCalvingDate?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  estimatedLactationNumber?: number;
}

/**
 * RAKHAL-307: "she has a current health condition" declared at intake —
 * trimmed subset of `CreateHealthCaseDto` (no vitals/shed override; this is
 * an intake declaration, not the full Report Sickness form).
 */
export class IntakeHealthConditionDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  note?: string;

  @IsOptional()
  @IsEnum(HealthCondition)
  condition?: HealthCondition;

  @IsEnum(HealthCareType)
  careType!: HealthCareType;

  @IsEnum(HealthPriority)
  priority!: HealthPriority;

  @IsOptional()
  @IsEnum(AppetiteStatus)
  appetite?: AppetiteStatus;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}

/**
 * RAKHAL-319: "she was AI'd/served but I don't know the result" declared at
 * intake — routes through `ReproductionService.createBreedingEvent` itself
 * (not a duplicated bespoke path), so it also gets RAKHAL-313's derive-only
 * status, RAKHAL-314's active-pregnancy guard, and a real pregnancy-check
 * task, same as a breeding recorded any other way.
 */
export class IntakeBreedingDto {
  @IsDateString()
  breedingDate!: string;

  @IsOptional()
  @IsEnum(BreedingMethod)
  breedingMethod?: BreedingMethod;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}

/**
 * RAKHAL-319: "she's currently in heat" declared at intake — routes through
 * `ReproductionService.createHeatEvent`, so it's a real unresolved
 * `HeatEvent`, editable and resolvable through the same machinery as any
 * heat recorded after the fact.
 */
export class IntakeHeatDto {
  @IsDateString()
  heatDateTime!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}

export const HISTORY_KINDS = [
  'LAST_CALVING',
  'LAST_BREEDING',
  'PREGNANT',
  'MILKING_SINCE',
  'DRY_SINCE',
  'LAST_VACCINATION',
] as const;
export type HistoryKind = (typeof HISTORY_KINDS)[number];

/**
 * RAKHAL-483: one "her history" entry given when an animal joins. Each entry is
 * recorded as a HISTORICAL event through the event API handlers, in the
 * cow-create transaction (no stock, finance, AQR or reminders).
 *
 * - LAST_CALVING:     `date`, optional `calvingNumber`
 * - LAST_BREEDING:    `date`, optional `method` (default AI), `bull` (name or code)
 * - PREGNANT:         optional `expectedCalvingDate` or `monthsPregnant` (check date = today)
 * - MILKING_SINCE:    `date` (start of the current lactation)
 * - DRY_SINCE:        `date`
 * - LAST_VACCINATION: `date`, optional `product`
 */
export class HistoryItemDto {
  @IsIn(HISTORY_KINDS)
  kind!: HistoryKind;

  @ValidateIf((o: HistoryItemDto) => o.kind !== 'PREGNANT')
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  calvingNumber?: number;

  @IsOptional()
  @IsEnum(BreedingMethod)
  method?: BreedingMethod;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  bull?: string;

  @IsOptional()
  @IsDateString()
  expectedCalvingDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  monthsPregnant?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  product?: string;
}
