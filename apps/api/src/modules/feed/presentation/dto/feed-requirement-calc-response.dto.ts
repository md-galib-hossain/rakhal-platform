import { ApiProperty } from '@nestjs/swagger';
import type { FeedRequirementsService } from '../../application/services/feed-requirements.service';
import type { RequirementOverrideService } from '../../application/services/requirement-override.service';
import {
  RequirementOverrideRowDto,
  RequirementProfileDto,
} from './feed-requirement-response.dto';

/**
 * Documented response shapes for `GET /feed/requirements` (a calculated-or-manual union) and the
 * requirement-override get / set / turn-off routes (RD-140). Each class mirrors what its service returns and
 * is pinned to it by a compile-time guard at the bottom of this file. Keys are snake_case where the service
 * builds them by hand. `Date` fields are ISO-8601 strings on the wire.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;
const NULLABLE_STRING = { type: String, nullable: true } as const;
const SOURCE = { enum: ['DYNAMIC', 'MANUAL'], enumName: 'RequirementSource' };

export class ManualDriftDto {
  @ApiProperty() dm_pct!: number;
  @ApiProperty() cp_pct!: number;
  @ApiProperty() me_pct!: number;
}

/** Present on a cow whose requirement is a manager-set manual value. */
export class ManualInfoDto {
  @ApiProperty() override_id!: string;
  @ApiProperty(DATE_TIME) set_at!: Date;
  @ApiProperty() set_by!: string;
  @ApiProperty(NULLABLE_STRING) note!: string | null;
  @ApiProperty({
    description:
      'True when her calculated requirement has drifted past the farm threshold since the value was set.',
  })
  stale!: boolean;
  @ApiProperty({ type: () => ManualDriftDto }) drift!: ManualDriftDto;
  @ApiProperty({
    description: 'True when her animal type changed since the value was set.',
  })
  animal_type_changed!: boolean;
}

export class ManualValidationIssueDto {
  @ApiProperty() field!: string;
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
}

export class RequirementCalcInputsDto {
  @ApiProperty() weight_kg!: number;
  @ApiProperty() milk_target_l!: number;
  @ApiProperty() milk_fat_pct!: number;
  @ApiProperty({
    required: false,
    type: Number,
    description: 'Herd calculation only.',
  })
  milk_protein_pct?: number;
  @ApiProperty({ required: false, type: Number }) gestation_days?: number;
  @ApiProperty({ required: false, type: Number }) bcs?: number;
  @ApiProperty({ required: false, type: Number }) dim?: number;
  @ApiProperty({
    enum: ['COW', 'HEIFER', 'DRY'],
    enumName: 'FeedAnimalType',
  })
  animal_type!: 'COW' | 'HEIFER' | 'DRY';
}

export class RequirementCalcDataSourceDto {
  @ApiProperty({ description: 'Where the weight came from.' })
  weight!: string;
  @ApiProperty({ description: 'Where the milk yield came from.' })
  milk_yield!: string;
  @ApiProperty({
    required: false,
    type: String,
    description: 'Cow calculation only.',
  })
  dim?: string;
}

/** `GET /feed/requirements?cattleId=…`: one cow, after the calculated-vs-manual decision. */
export class FeedRequirementCattleCalcDto {
  @ApiProperty(SOURCE) source!: 'DYNAMIC' | 'MANUAL';
  @ApiProperty({ type: () => RequirementCalcInputsDto })
  inputs!: RequirementCalcInputsDto;
  @ApiProperty({ type: () => RequirementCalcDataSourceDto })
  data_source!: RequirementCalcDataSourceDto;
  @ApiProperty({
    type: () => RequirementProfileDto,
    description: 'The requirement that applies (the manual one when MANUAL).',
  })
  requirements!: RequirementProfileDto;
  @ApiProperty({
    type: () => RequirementProfileDto,
    required: false,
    description: 'What the engine says today. Present only when MANUAL.',
  })
  dynamic_requirements?: RequirementProfileDto;
  @ApiProperty({
    type: () => ManualInfoDto,
    required: false,
    nullable: true,
    description: 'Present only when MANUAL.',
  })
  manual?: ManualInfoDto | null;
}

/** `GET /feed/requirements` without `cattleId` / `cattleIds`: a herd-level calculation from typed inputs. */
export class FeedRequirementHerdCalcDto {
  @ApiProperty({ type: () => RequirementCalcInputsDto })
  inputs!: RequirementCalcInputsDto;
  @ApiProperty({ type: () => RequirementCalcDataSourceDto })
  data_source!: RequirementCalcDataSourceDto;
  @ApiProperty({ type: () => RequirementProfileDto })
  requirements!: RequirementProfileDto;
}

/** One cow in the batched `?cattleIds=a,b,c` mode. */
export class FeedRequirementBatchCowDto {
  @ApiProperty() cattle_id!: string;
  @ApiProperty(SOURCE) source!: 'DYNAMIC' | 'MANUAL';
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'The inputs that fed the calculation (shape varies by cow).',
  })
  inputs!: Record<string, unknown>;
  @ApiProperty({
    type: [String],
    description: 'Data-quality flags. Empty for a manual requirement.',
  })
  flags!: string[];
  @ApiProperty({ type: () => RequirementProfileDto })
  requirements!: RequirementProfileDto;
  @ApiProperty({ type: () => RequirementProfileDto, required: false })
  dynamic_requirements?: RequirementProfileDto;
  @ApiProperty({ type: () => ManualInfoDto, required: false, nullable: true })
  manual?: ManualInfoDto | null;
}

/** Tolerance bands (percent) from the farm's requirement settings. */
export class FitBandsDto {
  @ApiProperty() dmBelowPct!: number;
  @ApiProperty() dmAbovePct!: number;
  @ApiProperty() cpBelowPct!: number;
  @ApiProperty() cpAbovePct!: number;
  @ApiProperty() meBelowPct!: number;
  @ApiProperty() meAbovePct!: number;
}

/** `GET /feed/requirements?cattleIds=a,b,c` */
export class FeedRequirementsBatchDto {
  @ApiProperty() date!: string;
  @ApiProperty({ type: () => [FeedRequirementBatchCowDto] })
  cows!: FeedRequirementBatchCowDto[];
  @ApiProperty({ type: [String] }) missing_cattle_ids!: string[];
  @ApiProperty({ type: () => FitBandsDto }) bands!: FitBandsDto;
}

/** A cow's requirement after the calculated-vs-manual decision (override routes). */
export class ResolvedRequirementDto {
  @ApiProperty() cattle_id!: string;
  @ApiProperty(SOURCE) source!: 'DYNAMIC' | 'MANUAL';
  @ApiProperty({ type: 'object', additionalProperties: true })
  inputs!: Record<string, unknown>;
  @ApiProperty({ type: [String] }) flags!: string[];
  @ApiProperty({ type: () => RequirementProfileDto })
  requirements!: RequirementProfileDto;
  @ApiProperty({ type: () => RequirementProfileDto, required: false })
  dynamic_requirements?: RequirementProfileDto;
  @ApiProperty({ type: () => ManualInfoDto, required: false, nullable: true })
  manual?: ManualInfoDto | null;
}

/** `GET /feed/cattle/:cattleId/requirement-override` */
export class RequirementOverrideStateDto {
  @ApiProperty({ type: () => RequirementOverrideRowDto, nullable: true })
  active!: RequirementOverrideRowDto | null;
  @ApiProperty({ type: () => ResolvedRequirementDto })
  resolved!: ResolvedRequirementDto;
  @ApiProperty({
    type: () => RequirementProfileDto,
    description: 'The engine-calculated requirement, whatever the source.',
  })
  calculated!: RequirementProfileDto;
  @ApiProperty({
    type: () => RequirementOverrideRowDto,
    nullable: true,
    description:
      'Newest closed override, to pre-fill "turn back on". Null if none.',
  })
  last!: RequirementOverrideRowDto | null;
}

/** `PUT /feed/cattle/:cattleId/requirement-override` */
export class RequirementOverrideSetResponseDto {
  @ApiProperty({ type: () => RequirementOverrideRowDto })
  active!: RequirementOverrideRowDto;
  @ApiProperty({ type: () => ResolvedRequirementDto })
  resolved!: ResolvedRequirementDto;
  @ApiProperty({
    type: () => [ManualValidationIssueDto],
    description: 'Soft-rule issues: the value was saved anyway.',
  })
  warnings!: ManualValidationIssueDto[];
}

/** `DELETE /feed/cattle/:cattleId/requirement-override` */
export class RequirementOverrideTurnOffResponseDto {
  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description: 'Always null: no override is open any more.',
  })
  active!: null;
  @ApiProperty({ type: () => ResolvedRequirementDto })
  resolved!: ResolvedRequirementDto;
}

// --- Compile-time guards (RD-140) -----------------------------------------------------------------------
// The services return unions that discriminate on an optional `dynamic_requirements?: undefined`, which no
// single documented class can equal. So each result is pinned two ways: every value the service returns must
// be assignable to the documented class (`Fits`), and every key the service returns must be documented
// (`Covers`). Exact equality (`Same`) is used wherever the service returns one plain shape.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Fits<S, D> = [S] extends [D] ? true : false;
type Keys<T> = T extends unknown ? keyof T : never;
type Covers<S, D> = [Keys<S>] extends [keyof D] ? true : false;
type Assert<T extends true> = T;
type Awaited1<F> = F extends (...args: never[]) => infer R ? Awaited<R> : never;
type Calc = Awaited1<FeedRequirementsService['calc']>;
type Batch = Awaited1<FeedRequirementsService['forCattle']>;
type OverrideGet = Awaited1<RequirementOverrideService['get']>;
type OverrideSet = Awaited1<RequirementOverrideService['set']>;
type OverrideOff = Awaited1<RequirementOverrideService['turnOff']>;

export type FeedRequirementCalcShapeGuards = [
  Assert<Fits<Calc, FeedRequirementCattleCalcDto | FeedRequirementHerdCalcDto>>,
  Assert<
    Covers<Calc, FeedRequirementCattleCalcDto & FeedRequirementHerdCalcDto>
  >,
  Assert<Same<Omit<Batch, 'cows'>, Omit<FeedRequirementsBatchDto, 'cows'>>>,
  Assert<Fits<Batch['cows'][number], FeedRequirementBatchCowDto>>,
  Assert<Covers<Batch['cows'][number], FeedRequirementBatchCowDto>>,
  Assert<Same<OverrideGet['active'], RequirementOverrideStateDto['active']>>,
  Assert<
    Same<OverrideGet['calculated'], RequirementOverrideStateDto['calculated']>
  >,
  Assert<Same<OverrideGet['last'], RequirementOverrideStateDto['last']>>,
  Assert<Covers<OverrideGet, RequirementOverrideStateDto>>,
  Assert<Fits<OverrideGet['resolved'], ResolvedRequirementDto>>,
  Assert<Covers<OverrideGet['resolved'], ResolvedRequirementDto>>,
  Assert<
    Same<OverrideSet['active'], RequirementOverrideSetResponseDto['active']>
  >,
  Assert<
    Same<OverrideSet['warnings'], RequirementOverrideSetResponseDto['warnings']>
  >,
  Assert<Covers<OverrideSet, RequirementOverrideSetResponseDto>>,
  Assert<Fits<OverrideSet['resolved'], ResolvedRequirementDto>>,
  Assert<
    Same<OverrideOff['active'], RequirementOverrideTurnOffResponseDto['active']>
  >,
  Assert<Covers<OverrideOff, RequirementOverrideTurnOffResponseDto>>,
  Assert<Fits<OverrideOff['resolved'], ResolvedRequirementDto>>,
];
