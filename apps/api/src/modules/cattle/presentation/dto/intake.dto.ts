import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  AppetiteStatus,
  BreedingMethod,
  HealthCondition,
  HealthDiagnosisType,
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
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  diagnosis!: string;

  @IsOptional()
  @IsEnum(HealthCondition)
  condition?: HealthCondition;

  @IsEnum(HealthDiagnosisType)
  diagnosisType!: HealthDiagnosisType;

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
