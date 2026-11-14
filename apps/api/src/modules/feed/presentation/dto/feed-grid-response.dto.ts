import { ApiProperty } from '@nestjs/swagger';
import {
  FeedGridSourceType,
  FeedPlanKind,
  FeedPlanLineType,
} from '@prisma/client';
import type { FeedFeedingGridService } from '../../application/services/feed-feeding-grid.service';
import { ManualInfoDto } from './feed-requirement-calc-response.dto';
import { RequirementProfileDto } from './feed-requirement-response.dto';

/**
 * Documented response shapes for the Feeding Grid routes (RD-140): grid, calendar, draft, confirm, one
 * cow's history and the per-cow void. Each class mirrors what `FeedFeedingGridService` returns and is pinned
 * to it by a compile-time guard at the bottom of this file. Keys are snake_case; `Date` fields are ISO-8601
 * strings on the wire; quantities are plain JSON numbers. Also exports the pieces the program / plan-fit
 * response shapes share (source, density, fit).
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;
const NULLABLE_NUMBER = { type: Number, nullable: true } as const;
const NULLABLE_STRING = { type: String, nullable: true } as const;
const SOURCE_TYPE = {
  enum: FeedGridSourceType,
  enumName: 'FeedGridSourceType',
} as const;
const FIT_SEVERITY = {
  enum: ['ok', 'warn', 'bad'],
  enumName: 'FeedFitSeverity',
} as const;
const PROGRAM_VIA = {
  enum: ['INDIVIDUAL', 'GROUP', 'HERD'],
  enumName: 'FeedProgramVia',
} as const;

// --- Shared pieces ------------------------------------------------------------------------------------------

/** Where a plan line's feed comes from, resolved. */
export class FeedSourceRefDto {
  @ApiProperty(SOURCE_TYPE) source_type!: FeedGridSourceType;
  @ApiProperty(NULLABLE_STRING) feed_item_id!: string | null;
  @ApiProperty(NULLABLE_STRING) feed_stock_id!: string | null;
}

/** Nutrient density of a feed, dry-matter basis. */
export class FeedDensityDto {
  @ApiProperty() dm_pct!: number;
  @ApiProperty() cp_pct!: number;
  @ApiProperty() me_mj_per_kg_dm!: number;
}

export class FeedFitNutrientDto {
  @ApiProperty({
    ...NULLABLE_NUMBER,
    description:
      'Supply vs requirement, in percent. Null when it cannot be judged.',
  })
  delta_pct!: number | null;
  @ApiProperty(FIT_SEVERITY) severity!: 'ok' | 'warn' | 'bad';
}

/** How well a ration's supply fits a cow's requirement: dry matter, crude protein, energy. */
export class FeedFitDto {
  @ApiProperty(FIT_SEVERITY) severity!: 'ok' | 'warn' | 'bad';
  @ApiProperty({
    description: 'True when part of the supply is estimated, not measured.',
  })
  estimated!: boolean;
  @ApiProperty({ type: () => FeedFitNutrientDto }) dm!: FeedFitNutrientDto;
  @ApiProperty({ type: () => FeedFitNutrientDto }) cp!: FeedFitNutrientDto;
  @ApiProperty({ type: () => FeedFitNutrientDto }) me!: FeedFitNutrientDto;
}

export class FeedSupplyDto {
  @ApiProperty() dm_kg!: number;
  @ApiProperty() cp_kg!: number;
  @ApiProperty() me_mj!: number;
  @ApiProperty({
    description: 'False when some feed in the supply has no nutrient data.',
  })
  complete!: boolean;
}

export class FeedRemainingRequirementDto {
  @ApiProperty() dm_kg!: number;
  @ApiProperty() cp_kg!: number;
  @ApiProperty() me_mj!: number;
}

// --- Grid ---------------------------------------------------------------------------------------------------

export class FeedGridFitSummaryDto {
  @ApiProperty() ok!: number;
  @ApiProperty() warn!: number;
  @ApiProperty() bad!: number;
  @ApiProperty() estimated!: number;
}

export class FeedGridSectionLineDto {
  @ApiProperty() line_id!: string;
  @ApiProperty({ enum: FeedPlanLineType, enumName: 'FeedPlanLineType' })
  line_type!: FeedPlanLineType;
  @ApiProperty() name!: string;
  @ApiProperty() kg_per_day!: number;
  @ApiProperty({ description: 'Per-head quantity the grid pre-fills.' })
  prefill_kg!: number;
  @ApiProperty({ type: () => FeedSourceRefDto, nullable: true })
  source!: FeedSourceRefDto | null;
  @ApiProperty({ type: () => FeedDensityDto, nullable: true })
  density!: FeedDensityDto | null;
  @ApiProperty() stock_ok!: boolean;
}

/** One program (plan) the day's cows are fed from. */
export class FeedGridSectionDto {
  @ApiProperty() id!: string;
  @ApiProperty() plan_id!: string;
  @ApiProperty() plan_name!: string;
  @ApiProperty({ enum: FeedPlanKind, enumName: 'FeedPlanKind' })
  kind!: FeedPlanKind;
  @ApiProperty(PROGRAM_VIA) via!: 'INDIVIDUAL' | 'GROUP' | 'HERD';
  @ApiProperty(NULLABLE_STRING) group_id!: string | null;
  @ApiProperty({ description: 'True when two programs overlap for a cow.' })
  conflict!: boolean;
  @ApiProperty({ type: () => FeedGridFitSummaryDto })
  fit_summary!: FeedGridFitSummaryDto;
  @ApiProperty({ type: [String] }) cattle_ids!: string[];
  @ApiProperty({ type: () => [FeedGridSectionLineDto] })
  lines!: FeedGridSectionLineDto[];
}

/** A saved, unconfirmed per-cow quantity. */
export class FeedGridDraftRowDto {
  @ApiProperty() id!: string;
  @ApiProperty(SOURCE_TYPE) source_type!: FeedGridSourceType;
  @ApiProperty(NULLABLE_STRING) feed_item_id!: string | null;
  @ApiProperty(NULLABLE_STRING) feed_stock_id!: string | null;
  @ApiProperty() offered_kg!: number;
  @ApiProperty(NULLABLE_NUMBER) refusal_kg!: number | null;
  @ApiProperty(NULLABLE_STRING) plan_line_id!: string | null;
  @ApiProperty(DATE_TIME) updated_at!: Date;
}

export class FeedLookaheadEventDto {
  @ApiProperty({
    enum: ['dry_off', 'calving', 'peak_dim'],
    enumName: 'FeedLookaheadKind',
  })
  kind!: 'dry_off' | 'calving' | 'peak_dim';
  @ApiProperty({
    description:
      'Whole days from today (UTC). Negative = overdue and not yet recorded.',
  })
  in_days!: number;
}

/** The requirement the grid fits against: calculated, or the manager-set manual one. */
export class FeedGridCowRequirementDto {
  @ApiProperty({ enum: ['DYNAMIC', 'MANUAL'], enumName: 'RequirementSource' })
  source!: 'DYNAMIC' | 'MANUAL';
  @ApiProperty() dm_kg!: number;
  @ApiProperty() cp_kg!: number;
  @ApiProperty() me_mj!: number;
  @ApiProperty({ type: [String], description: 'Data-quality flags.' })
  flags!: string[];
  @ApiProperty({
    type: () => RequirementProfileDto,
    required: false,
    description: 'What the engine says today. Present only when MANUAL.',
  })
  dynamic_requirements?: RequirementProfileDto;
  @ApiProperty({ type: () => ManualInfoDto, required: false, nullable: true })
  manual?: ManualInfoDto | null;
}

export class FeedGridCowDto {
  @ApiProperty() cattle_id!: string;
  @ApiProperty(NULLABLE_STRING) name!: string | null;
  @ApiProperty() tag_number!: string;
  @ApiProperty({ type: () => [FeedGridDraftRowDto] })
  drafts!: FeedGridDraftRowDto[];
  @ApiProperty({
    ...NULLABLE_NUMBER,
    description: 'Carried-forward per-head quantity (last confirmed).',
  })
  default_offered_kg!: number | null;
  @ApiProperty({ type: () => FeedSourceRefDto, nullable: true })
  default_source!: FeedSourceRefDto | null;
  @ApiProperty(NULLABLE_NUMBER) confirmed_offered_kg!: number | null;
  @ApiProperty({ type: () => FeedSupplyDto, nullable: true })
  confirmed_supply!: FeedSupplyDto | null;
  @ApiProperty({ type: () => FeedSupplyDto, nullable: true })
  planned_supply!: FeedSupplyDto | null;
  @ApiProperty({ type: () => FeedFitDto, nullable: true })
  fit!: FeedFitDto | null;
  @ApiProperty({
    type: () => FeedRemainingRequirementDto,
    nullable: true,
    description: 'Her requirement minus what she was already fed today.',
  })
  remaining_requirement!: FeedRemainingRequirementDto | null;
  @ApiProperty({ type: () => FeedGridCowRequirementDto, nullable: true })
  requirement!: FeedGridCowRequirementDto | null;
  @ApiProperty(NULLABLE_STRING) program_section_id!: string | null;
  @ApiProperty() program_conflict!: boolean;
  @ApiProperty({ type: () => [FeedLookaheadEventDto] })
  lookahead!: FeedLookaheadEventDto[];
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Planned per-head kg, keyed by plan line id.',
  })
  planned_kg_by_line!: Record<string, number>;
}

/** `GET /feed/grid` */
export class FeedGridResponseDto {
  @ApiProperty({ description: 'The day, `YYYY-MM-DD`.' }) date!: string;
  @ApiProperty({ type: () => [FeedGridSectionDto] })
  sections!: FeedGridSectionDto[];
  @ApiProperty({ type: () => [FeedGridCowDto] }) cows!: FeedGridCowDto[];
}

// --- Calendar -----------------------------------------------------------------------------------------------

export class FeedGridCalendarDayDto {
  @ApiProperty({ description: '`YYYY-MM-DD`.' }) date!: string;
  @ApiProperty({
    enum: ['complete', 'partial', 'missing', 'future', 'before_farm'],
    enumName: 'FeedGridDayStatus',
  })
  status!: 'complete' | 'partial' | 'missing' | 'future' | 'before_farm';
}

/** `GET /feed/grid/calendar` */
export class FeedGridCalendarResponseDto {
  @ApiProperty({ description: 'The month, `YYYY-MM`.' }) month!: string;
  @ApiProperty({ type: () => [FeedGridCalendarDayDto] })
  days!: FeedGridCalendarDayDto[];
}

// --- Draft / confirm ----------------------------------------------------------------------------------------

/** `POST /feed/grid/draft` */
export class FeedGridDraftResponseDto {
  @ApiProperty({ description: 'Number of cow rows written.' }) saved!: number;
  @ApiProperty({
    type: () => [FeedGridDraftRowDto],
    description: "The cows' drafts for that source after the save.",
  })
  drafts!: FeedGridDraftRowDto[];
}

export class FeedGridConfirmSourceDto {
  @ApiProperty(SOURCE_TYPE) source_type!: FeedGridSourceType;
  @ApiProperty(NULLABLE_STRING) feed_item_id!: string | null;
  @ApiProperty(NULLABLE_STRING) feed_stock_id!: string | null;
  @ApiProperty() total_kg!: number;
}

export class FeedGridConfirmCowDto {
  @ApiProperty() offered_kg!: number;
  @ApiProperty() refusal_kg!: number;
  @ApiProperty() cost_tk!: number;
  [extra: string]: unknown;
}

/** `POST /feed/grid/confirm` */
export class FeedGridConfirmResponseDto {
  @ApiProperty({ description: 'The new `FeedDistribution` id.' }) id!: string;
  @ApiProperty({ description: '`YYYY-MM-DD`.' }) date!: string;
  @ApiProperty() total_actual_kg!: number;
  @ApiProperty() total_actual_cost!: number;
  @ApiProperty({ type: () => [FeedGridConfirmSourceDto] })
  sources!: FeedGridConfirmSourceDto[];
  @ApiProperty({
    type: () => [FeedGridConfirmCowDto],
    description:
      'Per-cow lines. Besides the three named figures each carries the cow identity and nutrient totals the distribution recorded.',
  })
  cows!: FeedGridConfirmCowDto[];
}

// --- One cow's history --------------------------------------------------------------------------------------

export class FeedCattleHistoryRequirementDto extends RequirementProfileDto {
  @ApiProperty({ enum: ['DYNAMIC', 'MANUAL'], enumName: 'RequirementSource' })
  source!: 'DYNAMIC' | 'MANUAL';
}

/** Which nutrient totals rest on measured feed data (true) rather than a default (false). */
export class FeedCattleHistoryMeasuredDto {
  @ApiProperty() dm_kg!: boolean;
  @ApiProperty() cp_kg!: boolean;
  @ApiProperty() me_mj!: boolean;
  @ApiProperty() fat_kg!: boolean;
  @ApiProperty() ndf_kg!: boolean;
  @ApiProperty() adf_kg!: boolean;
  @ApiProperty() starch_kg!: boolean;
  @ApiProperty() tdn_kg!: boolean;
  @ApiProperty() calcium_kg!: boolean;
  @ApiProperty() phosphorus_kg!: boolean;
  @ApiProperty() rdp_kg!: boolean;
  @ApiProperty() rup_kg!: boolean;
}

export class FeedCattleHistoryTotalsDto {
  @ApiProperty() dm_kg!: number;
  @ApiProperty() cp_kg!: number;
  @ApiProperty() me_mj!: number;
  @ApiProperty() fat_kg!: number;
  @ApiProperty() ndf_kg!: number;
  @ApiProperty() adf_kg!: number;
  @ApiProperty() starch_kg!: number;
  @ApiProperty() tdn_kg!: number;
  @ApiProperty() calcium_kg!: number;
  @ApiProperty() phosphorus_kg!: number;
  @ApiProperty() rdp_kg!: number;
  @ApiProperty() rup_kg!: number;
}

export class FeedCattleHistoryEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty() distribution_id!: string;
  @ApiProperty() offered_kg!: number;
  @ApiProperty() refusal_kg!: number;
  @ApiProperty(NULLABLE_NUMBER) cost_tk!: number | null;
  @ApiProperty(NULLABLE_STRING) feed_name!: string | null;
  @ApiProperty({ ...SOURCE_TYPE, nullable: true })
  source_type!: FeedGridSourceType | null;
  @ApiProperty(DATE_TIME) fed_at!: Date;
  @ApiProperty({ ...DATE_TIME, nullable: true }) voided_at!: Date | null;
  @ApiProperty(NULLABLE_STRING) voided_by!: string | null;
  @ApiProperty(NULLABLE_STRING) void_reason!: string | null;
}

/** `GET /feed/grid/cattle/:cattleId/history` */
export class FeedCattleHistoryResponseDto {
  @ApiProperty() cattle_id!: string;
  @ApiProperty({ description: '`YYYY-MM-DD`.' }) date!: string;
  @ApiProperty({ type: () => FeedCattleHistoryRequirementDto, nullable: true })
  requirement!: FeedCattleHistoryRequirementDto | null;
  @ApiProperty({ type: () => FeedCattleHistoryMeasuredDto })
  measured!: FeedCattleHistoryMeasuredDto;
  @ApiProperty({ type: () => [FeedCattleHistoryEntryDto] })
  entries!: FeedCattleHistoryEntryDto[];
  @ApiProperty({
    type: () => FeedCattleHistoryTotalsDto,
    description: 'Totals over the non-voided entries.',
  })
  totals!: FeedCattleHistoryTotalsDto;
}

/** `POST /feed/grid/distributions/:distributionId/cattle/:cattleItemId/void` */
export class FeedGridVoidResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() cattle_id!: string;
  @ApiProperty() offered_kg!: number;
  @ApiProperty({ ...DATE_TIME, nullable: true }) voided_at!: Date | null;
  @ApiProperty(NULLABLE_STRING) voided_by!: string | null;
  @ApiProperty(NULLABLE_STRING) void_reason!: string | null;
}

// --- Compile-time guards (RD-140) -----------------------------------------------------------------------
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Fits<S, D> = [S] extends [D] ? true : false;
type Keys<T> = T extends unknown ? keyof T : never;
type Covers<S, D> = [Keys<S>] extends [keyof D] ? true : false;
type Assert<T extends true> = T;
type Awaited1<F> = F extends (...args: never[]) => infer R ? Awaited<R> : never;
type Svc = FeedFeedingGridService;
type Grid = Awaited1<Svc['getGrid']>;
type GridCow = Grid['cows'][number];
type Confirm = Awaited1<Svc['confirm']>;

export type FeedGridShapeGuards = [
  Assert<Same<Grid['date'], string>>,
  Assert<Same<Grid['sections'], FeedGridSectionDto[]>>,
  // Cow: every field but `requirement` (a union on the optional manual/dynamic pair) is exact.
  Assert<
    Same<Omit<GridCow, 'requirement'>, Omit<FeedGridCowDto, 'requirement'>>
  >,
  Assert<Fits<NonNullable<GridCow['requirement']>, FeedGridCowRequirementDto>>,
  Assert<
    Covers<NonNullable<GridCow['requirement']>, FeedGridCowRequirementDto>
  >,
  Assert<Same<Awaited1<Svc['calendar']>, FeedGridCalendarResponseDto>>,
  Assert<Same<Awaited1<Svc['saveDraft']>, FeedGridDraftResponseDto>>,
  // Confirm: each cow row is an open record carrying three known numbers.
  Assert<Same<Omit<Confirm, 'cows'>, Omit<FeedGridConfirmResponseDto, 'cows'>>>,
  Assert<Fits<Confirm['cows'][number], FeedGridConfirmCowDto>>,
  Assert<Same<Awaited1<Svc['cattleHistory']>, FeedCattleHistoryResponseDto>>,
  Assert<Same<Awaited1<Svc['voidCattleItem']>, FeedGridVoidResponseDto>>,
];
