import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeedPlanKind, FeedPlanLineType } from '@prisma/client';
import type { FeedPlanService } from '../../application/services/feed-plan.service';
import type { FeedController } from '../controllers/feed.controller';
import { ConcentrationDetailDto } from './feed-concentration-response.dto';
import {
  FeedDensityDto,
  FeedFitDto,
  FeedSourceRefDto,
} from './feed-grid-response.dto';

/**
 * Documented response shapes for the feeding-program routes (RD-140): a cow's current program, her resolved
 * ration, and plan fit / preview-fit (supply vs requirement). Each class mirrors what its service (or the
 * controller, for the resolved ration) returns and is pinned to it by a compile-time guard at the bottom of
 * this file. Keys are snake_case, except `nutrition` on a fit line, which is the domain's camelCase shape.
 */

const NULLABLE_NUMBER = { type: Number, nullable: true } as const;
const NULLABLE_STRING = { type: String, nullable: true } as const;
const PROGRAM_VIA = {
  enum: ['INDIVIDUAL', 'GROUP', 'HERD'],
  enumName: 'FeedProgramVia',
} as const;
const REQUIREMENT_SOURCE = {
  enum: ['DYNAMIC', 'MANUAL'],
  enumName: 'RequirementSource',
} as const;

// --- A cow's current program (GET /feed/cattle/:cattleId/program) ------------------------------------------

export class FeedProgramLineDto {
  @ApiProperty() line_id!: string;
  @ApiProperty({ enum: FeedPlanLineType, enumName: 'FeedPlanLineType' })
  line_type!: FeedPlanLineType;
  @ApiProperty() name!: string;
  @ApiProperty() kg_per_day!: number;
  @ApiProperty({ type: () => FeedSourceRefDto, nullable: true })
  source!: FeedSourceRefDto | null;
  @ApiProperty({ type: () => FeedDensityDto, nullable: true })
  density!: FeedDensityDto | null;
  @ApiProperty() stock_ok!: boolean;
}

export class FeedProgramDto {
  @ApiProperty() assignment_id!: string;
  @ApiProperty() plan_id!: string;
  @ApiProperty() plan_name!: string;
  @ApiProperty({ enum: FeedPlanKind, enumName: 'FeedPlanKind' })
  kind!: FeedPlanKind;
  /** `via`: how the plan reaches her: individually, via a group, or herd-wide. */
  @ApiProperty(PROGRAM_VIA)
  via!: 'INDIVIDUAL' | 'GROUP' | 'HERD';
  @ApiProperty(NULLABLE_STRING) group_id!: string | null;
  @ApiProperty({ description: 'True when two group programs overlap for her.' })
  conflict!: boolean;
  @ApiProperty({ type: () => [FeedProgramLineDto] })
  lines!: FeedProgramLineDto[];
}

/** `GET /feed/cattle/:cattleId/program` */
export class FeedCattleProgramResponseDto {
  @ApiProperty({
    type: () => FeedProgramDto,
    nullable: true,
    description: 'Null when no plan is applied to her.',
  })
  program!: FeedProgramDto | null;
}

// --- Resolved ration (GET /feed/cattle/:cattleId/resolved-ration) ------------------------------------------

/** `GET /feed/cattle/:cattleId/resolved-ration` */
export class FeedResolvedRationResponseDto {
  /** Most specific level the ration matched at. Null when she is on no active ration. */
  @ApiProperty({ ...PROGRAM_VIA, nullable: true })
  match_level!: 'INDIVIDUAL' | 'GROUP' | 'HERD' | null;
  @ApiProperty({ type: () => ConcentrationDetailDto, nullable: true })
  concentration!: ConcentrationDetailDto | null;
}

// --- Plan fit (GET /feed/plans/:id/fit, POST /feed/plans/preview-fit) --------------------------------------

/**
 * Nutrient composition of a feed. **camelCase**: this is the domain's own shape, passed through unchanged.
 * Percent values are % of dry matter unless the name says otherwise.
 */
export class FeedNutritionValuesDto {
  @ApiProperty() dmPct!: number;
  @ApiProperty() cpPct!: number;
  @ApiProperty() meMjPerKgDm!: number;
  @ApiProperty(NULLABLE_NUMBER) fatPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) ndfPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) adfPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) rdpPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) rupPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) starchPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) sugarsPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) calciumPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) phosphorusPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) tdnPct!: number | null;
}

export class FeedFitLineSupplyDto {
  @ApiProperty() as_fed_kg!: number;
  @ApiProperty(NULLABLE_NUMBER) dm_kg!: number | null;
  @ApiProperty(NULLABLE_NUMBER) cp_kg!: number | null;
  @ApiProperty(NULLABLE_NUMBER) me_mj!: number | null;
}

export class FeedFitLineDto {
  @ApiProperty() line_id!: string;
  @ApiProperty({ enum: FeedPlanLineType, enumName: 'FeedPlanLineType' })
  line_type!: FeedPlanLineType;
  @ApiProperty(NULLABLE_STRING) feed_item_id!: string | null;
  @ApiProperty(NULLABLE_STRING) concentration_id!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty() kg_per_day!: number;
  @ApiProperty({ type: () => FeedDensityDto, nullable: true })
  density!: FeedDensityDto | null;
  @ApiProperty({ type: () => FeedSourceRefDto, nullable: true })
  source!: FeedSourceRefDto | null;
  @ApiProperty() stock_ok!: boolean;
  @ApiProperty({ type: () => FeedNutritionValuesDto, nullable: true })
  nutrition!: FeedNutritionValuesDto | null;
  @ApiProperty({ type: () => FeedFitLineSupplyDto })
  supply!: FeedFitLineSupplyDto;
}

export class FeedFitSupplyTotalDto {
  @ApiProperty() as_fed_kg!: number;
  @ApiProperty() dm_kg!: number;
  @ApiProperty() cp_kg!: number;
  @ApiProperty() me_mj!: number;
}

export class FeedFitRequirementDto {
  @ApiProperty() dm_kg!: number;
  @ApiProperty() cp_kg!: number;
  @ApiProperty() me_mj!: number;
}

/** The cow's full requirement as the fit table needs it. */
export class FeedPlanRequirementDto {
  @ApiProperty() dm_kg!: number;
  @ApiProperty() cp_kg!: number;
  @ApiProperty() me_mj!: number;
  @ApiProperty() fat_kg!: number;
  @ApiProperty() ndf_kg!: number;
  @ApiProperty() ndf_max_kg!: number;
  @ApiProperty() adf_kg!: number;
  @ApiProperty() tdn_kg!: number;
  @ApiProperty({
    ...NULLABLE_NUMBER,
    description:
      'Null for a manual-requirement cow (needs live weight and milk).',
  })
  calcium_kg!: number | null;
  @ApiProperty(NULLABLE_NUMBER) phosphorus_kg!: number | null;
  @ApiProperty() rdp_pct!: number;
  @ApiProperty() rup_pct!: number;
  @ApiProperty() ca_p_ratio_target!: number;
}

export class FeedFitDeltaPctDto {
  @ApiProperty(NULLABLE_NUMBER) dm!: number | null;
  @ApiProperty(NULLABLE_NUMBER) cp!: number | null;
  @ApiProperty(NULLABLE_NUMBER) me!: number | null;
}

/** One nutrient's supply-vs-requirement row. */
export class FeedNutrientRowDto {
  @ApiProperty({
    enum: [
      'dm',
      'cp',
      'me',
      'fat',
      'ndf',
      'adf',
      'tdn',
      'calcium',
      'phosphorus',
      'ca_p_ratio',
      'rdp_pct',
      'rup_pct',
      'starch',
    ],
    enumName: 'FeedNutrientRowKey',
  })
  key!:
    | 'dm'
    | 'cp'
    | 'me'
    | 'fat'
    | 'ndf'
    | 'adf'
    | 'tdn'
    | 'calcium'
    | 'phosphorus'
    | 'ca_p_ratio'
    | 'rdp_pct'
    | 'rup_pct'
    | 'starch';
  @ApiProperty({
    enum: ['kg', 'MJ', '% of CP', ': 1'],
    enumName: 'FeedNutrientUnit',
  })
  unit!: 'kg' | 'MJ' | '% of CP' | ': 1';
  @ApiProperty(NULLABLE_NUMBER) supply!: number | null;
  @ApiProperty(NULLABLE_NUMBER) requirement!: number | null;
  @ApiProperty({
    ...NULLABLE_NUMBER,
    description: 'Upper limit where one exists (NDF).',
  })
  max!: number | null;
  @ApiProperty(NULLABLE_NUMBER) delta_pct!: number | null;
  @ApiProperty({
    enum: ['ok', 'warn', 'bad', 'unknown'],
    enumName: 'FeedNutrientSeverity',
  })
  severity!: 'ok' | 'warn' | 'bad' | 'unknown';
  @ApiProperty({
    description: 'False when the supply figure rests on a default, not data.',
  })
  measured!: boolean;
}

/** What one fit calculation says about one cow's requirement and the ration against it. */
export class FeedFitBodyDto {
  @ApiProperty({ type: () => FeedFitRequirementDto })
  requirement!: FeedFitRequirementDto;
  @ApiProperty({ type: () => FeedPlanRequirementDto })
  requirement_full!: FeedPlanRequirementDto;
  @ApiProperty({ type: () => FeedFitDeltaPctDto })
  delta_pct!: FeedFitDeltaPctDto;
  @ApiProperty({ type: () => FeedFitDto }) fit!: FeedFitDto;
  @ApiProperty({ type: () => [FeedNutrientRowDto] })
  nutrients!: FeedNutrientRowDto[];
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'The inputs that fed the calculation (shape varies).',
  })
  inputs!: unknown;
  @ApiProperty({ type: [String], description: 'Data-quality flags.' })
  flags!: string[];
  @ApiProperty(REQUIREMENT_SOURCE) source!: 'DYNAMIC' | 'MANUAL';
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'What the engine says today. Present only when MANUAL (same shape as a requirement profile).',
  })
  dynamic_requirements?: unknown;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'The manual override that applies (same shape as `manual` on the requirement routes). Present only when MANUAL.',
  })
  manual?: unknown;
}

export class FeedFitCowDto extends FeedFitBodyDto {
  @ApiProperty() cattle_id!: string;
}

/** `GET /feed/plans/:id/fit` */
export class FeedPlanFitResponseDto {
  @ApiProperty() plan_id!: string;
  @ApiProperty({ description: '`YYYY-MM-DD`.' }) date!: string;
  @ApiProperty({ type: () => [FeedFitLineDto] }) lines!: FeedFitLineDto[];
  @ApiProperty({ type: () => FeedFitSupplyTotalDto })
  supply!: FeedFitSupplyTotalDto;
  @ApiProperty({
    description: 'False when some line has no nutrient data.',
  })
  supply_complete!: boolean;
  @ApiProperty({ type: () => [FeedFitCowDto] }) cows!: FeedFitCowDto[];
  @ApiProperty({
    type: [String],
    description: 'Requested cattle ids that could not be found.',
  })
  missing_cattle_ids!: string[];
}

/** `POST /feed/plans/preview-fit` */
export class FeedPlanPreviewFitResponseDto extends FeedFitBodyDto {
  @ApiProperty({ type: () => [FeedFitLineDto] }) lines!: FeedFitLineDto[];
  @ApiProperty({ type: () => FeedFitSupplyTotalDto })
  supply!: FeedFitSupplyTotalDto;
  @ApiProperty() supply_complete!: boolean;
}

// --- Compile-time guards (RD-140) -----------------------------------------------------------------------
// `inputs`, `dynamic_requirements` and `manual` leak out of the service as `unknown` / `{}`, so they are
// excluded from the exact comparisons and pinned only by name (`Covers`).
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Keys<T> = T extends unknown ? keyof T : never;
type Covers<S, D> = [Keys<S>] extends [keyof D] ? true : false;
type Assert<T extends true> = T;
type Awaited1<F> = F extends (...args: never[]) => infer R ? Awaited<R> : never;
type Loose = 'inputs' | 'dynamic_requirements' | 'manual';
type Fit = Awaited1<FeedPlanService['fit']>;
type Preview = Awaited1<FeedPlanService['previewFit']>;
type FitCow = Fit['cows'][number];
type Program = Awaited1<FeedPlanService['programForCattle']>;
type Ration = Awaited1<FeedController['resolvedRation']>;

export type FeedProgramShapeGuards = [
  Assert<Same<Program, FeedCattleProgramResponseDto>>,
  Assert<Same<Omit<Fit, 'cows'>, Omit<FeedPlanFitResponseDto, 'cows'>>>,
  Assert<Same<Omit<FitCow, Loose>, Omit<FeedFitCowDto, Loose>>>,
  Assert<Covers<FitCow, FeedFitCowDto>>,
  Assert<
    Same<Omit<Preview, Loose>, Omit<FeedPlanPreviewFitResponseDto, Loose>>
  >,
  Assert<Covers<Preview, FeedPlanPreviewFitResponseDto>>,
  // Two branches (matched / not matched) folded into one class. `concentrations.get` is typed as a
  // summary-or-detail union, so its detail branch is pinned the way the concentration DTOs pin it.
  Assert<
    Same<Ration['match_level'], FeedResolvedRationResponseDto['match_level']>
  >,
  Assert<
    Same<
      Extract<NonNullable<Ration['concentration']>, { ingredients: unknown }>,
      ConcentrationDetailDto
    >
  >,
  Assert<Covers<Ration, FeedResolvedRationResponseDto>>,
];
