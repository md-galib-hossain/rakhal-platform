import { ApiProperty } from '@nestjs/swagger';
import {
  FeedClass,
  FeedConcentrationKind,
  FeedNutrientGroup,
  FeedPlanKind,
  FeedPlanLineType,
  FeedPlanTarget,
  FeedStockMovementReason,
  FeedSubType,
  NutritionSource as PrismaNutritionSource,
  type Prisma,
} from '@prisma/client';
import type { CursorPage } from 'src/common/pagination/cursor-page.type';
import type { BulkDeleteResponseDto } from 'src/modules/inventory/presentation/dto/inventory-response.dto';
import type { FeedConcentrationService } from '../../application/services/feed-concentration.service';
import type { FeedDistributionService } from '../../application/services/feed-distribution.service';
import type { FeedIngredientService } from '../../application/services/feed-ingredient.service';
import type { FeedPlanAssignmentService } from '../../application/services/feed-plan-assignment.service';
import type { ProgramVia } from '../../application/services/feed-plan-resolver.service';
import type { FeedPlanService } from '../../application/services/feed-plan.service';
import type { FeedStockService } from '../../application/services/feed-stock.service';
import type {
  NutritionSource,
  PriceSource,
} from '../../domain/ingredient-resolver';

/**
 * Documented response shapes for the feed routes typed under RD-140 (stock, plans and plan assignments,
 * distributions, ingredients). Each class mirrors what the service really returns and is pinned to it by a
 * compile-time guard at the bottom of this file, so a change in a service (or a Prisma column) fails
 * `nest build` until this file follows. These services build their responses by hand, so the keys are
 * snake_case. `Date` fields are ISO-8601 strings on the wire; quantities and costs are plain JSON numbers.
 *
 * Not covered yet (RD-140): concentrations, feed items, requirements, requirement overrides and the feeding
 * grid, whose shapes are 1-4 KB each.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;
const NULLABLE_NUMBER = { type: Number, nullable: true } as const;
const NULLABLE_STRING = { type: String, nullable: true } as const;

// ─── Ingredients ───────────────────────────────────────────────────────────

/** Nutrient figures of a catalogue ingredient (all present, % of dry matter unless stated). */
export class FeedNutritionDto {
  @ApiProperty() dm_pct!: number;
  @ApiProperty() cp_pct!: number;
  @ApiProperty() me_mj_per_kg_dm!: number;
  @ApiProperty() fat_pct!: number;
  @ApiProperty() ndf_pct!: number;
  @ApiProperty() rdp_pct!: number;
  @ApiProperty() rup_pct!: number;
  @ApiProperty() starch_pct!: number;
  @ApiProperty() adf_pct!: number;
  @ApiProperty() calcium_pct!: number;
  @ApiProperty() phosphorus_pct!: number;
  @ApiProperty() tdn_pct!: number;
}

export class FeedIngredientResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name_en!: string;
  @ApiProperty(NULLABLE_STRING) name_bn!: string | null;
  @ApiProperty({ enum: FeedClass, enumName: 'FeedClass' })
  feed_class!: FeedClass;
  @ApiProperty({ enum: FeedSubType, enumName: 'FeedSubType', nullable: true })
  feed_sub_type!: FeedSubType | null;
  @ApiProperty({
    enum: FeedNutrientGroup,
    enumName: 'FeedNutrientGroup',
    nullable: true,
  })
  nutrient_group!: FeedNutrientGroup | null;
  @ApiProperty() is_custom!: boolean;
  @ApiProperty(NULLABLE_STRING) nutrition_source!: string | null;
  @ApiProperty({
    enum: ['REFERENCE', 'MANUFACTURER', 'LAB', 'FARM_ESTIMATE'],
    enumName: 'IngredientNutritionSource',
  })
  nutrition_source_type!: NutritionSource;
  @ApiProperty(NULLABLE_STRING) source_ref!: string | null;
  @ApiProperty() rakhal_price_per_kg!: number;
  @ApiProperty({ ...DATE_TIME, nullable: true })
  price_updated_at!: Date | null;
  @ApiProperty() effective_price_per_kg!: number;
  @ApiProperty({
    enum: ['rakhal_market', 'farm_override'],
    enumName: 'IngredientPriceSource',
  })
  price_source!: PriceSource;
  @ApiProperty() has_nutrition_override!: boolean;
  @ApiProperty() is_available_bd!: boolean;
  @ApiProperty({ type: () => FeedNutritionDto })
  nutrition!: FeedNutritionDto;
  @ApiProperty(NULLABLE_STRING) override_notes!: string | null;
}

/** A farm's own price / nutrition override row for one catalogue ingredient (camelCase: raw row). */
export class FeedIngredientOverrideResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() ingredientId!: string;
  @ApiProperty(NULLABLE_NUMBER) customPricePerKg!: number | null;
  @ApiProperty(NULLABLE_NUMBER) customDmPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) customCpPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) customMeMjPerKgDm!: number | null;
  @ApiProperty(NULLABLE_NUMBER) customFatPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) customNdfPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) customRdpPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) customRupPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) customStarchPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) customAdfPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) customCalciumPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) customPhosphorusPct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) customTdnPct!: number | null;
  @ApiProperty({
    enum: PrismaNutritionSource,
    enumName: 'NutritionSource',
    nullable: true,
  })
  nutritionSource!: PrismaNutritionSource | null;
  @ApiProperty(NULLABLE_STRING) sourceRef!: string | null;
  @ApiProperty(NULLABLE_STRING) notes!: string | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

export class ResetOverrideResponseDto {
  @ApiProperty() ingredient_id!: string;
  @ApiProperty() price_source!: string;
}

// ─── Stock (prepared feed made from a finalised recipe) ────────────────────

/** Nutrient figures of a stock batch; everything past `me_mj_per_kg_dm` may be unmeasured. */
export class FeedStockNutritionDto {
  @ApiProperty() dm_pct!: number;
  @ApiProperty() cp_pct!: number;
  @ApiProperty() me_mj_per_kg_dm!: number;
  @ApiProperty(NULLABLE_NUMBER) fat_pct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) ndf_pct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) rdp_pct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) rup_pct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) starch_pct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) adf_pct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) calcium_pct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) phosphorus_pct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) tdn_pct!: number | null;
}

export class FeedStockResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({
    enum: FeedConcentrationKind,
    enumName: 'FeedConcentrationKind',
  })
  kind!: FeedConcentrationKind;
  @ApiProperty() source_concentration_id!: string;
  @ApiProperty() source_concentration_version!: number;
  @ApiProperty(DATE_TIME) produced_at!: Date;
  @ApiProperty() produced_qty_kg!: number;
  @ApiProperty() current_stock_kg!: number;
  @ApiProperty() produced_cost_tk!: number;
  @ApiProperty(DATE_TIME) created_at!: Date;
  @ApiProperty({ type: () => FeedStockNutritionDto })
  nutrition!: FeedStockNutritionDto;
  @ApiProperty({ enum: PrismaNutritionSource, enumName: 'NutritionSource' })
  nutrition_source!: PrismaNutritionSource;
  @ApiProperty(NULLABLE_STRING) source_ref!: string | null;
  @ApiProperty() nutrition_profile_id!: string;
}

export class FeedStockMovementDto {
  @ApiProperty() id!: string;
  @ApiProperty() change_kg!: number;
  @ApiProperty({
    enum: FeedStockMovementReason,
    enumName: 'FeedStockMovementReason',
  })
  reason!: FeedStockMovementReason;
  @ApiProperty(NULLABLE_STRING) distribution_id!: string | null;
  @ApiProperty(DATE_TIME) created_at!: Date;
}

export class FeedStockDetailResponseDto extends FeedStockResponseDto {
  @ApiProperty({ type: () => [FeedStockMovementDto] })
  movements!: FeedStockMovementDto[];
}

// ─── Plans ─────────────────────────────────────────────────────────────────

export class FeedPlanLineResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: FeedPlanLineType, enumName: 'FeedPlanLineType' })
  line_type!: FeedPlanLineType;
  @ApiProperty(NULLABLE_STRING) feed_item_id!: string | null;
  @ApiProperty(NULLABLE_STRING) concentration_id!: string | null;
  @ApiProperty(NULLABLE_STRING) name!: string | null;
  @ApiProperty(NULLABLE_STRING) recipe_kind!: string | null;
  @ApiProperty() kg_per_day!: number;
  @ApiProperty() sort_order!: number;
}

export class FeedPlanAppliedToDto {
  @ApiProperty({ type: [String] }) cattle_ids!: string[];
  @ApiProperty({ type: [String] }) group_ids!: string[];
  @ApiProperty() herd!: boolean;
}

export class FeedPlanResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: FeedPlanKind, enumName: 'FeedPlanKind' })
  kind!: FeedPlanKind;
  @ApiProperty(NULLABLE_STRING) notes!: string | null;
  @ApiProperty(NULLABLE_STRING) made_for_cattle_id!: string | null;
  @ApiProperty(NULLABLE_STRING) made_for_animal_group_id!: string | null;
  @ApiProperty({
    type: Object,
    nullable: true,
    description:
      'The requirement snapshot the plan was built against (free-form JSON, or null).',
  })
  reference_requirement!: Prisma.JsonValue;
  @ApiProperty() is_active!: boolean;
  @ApiProperty({ type: () => FeedPlanAppliedToDto })
  applied_to!: FeedPlanAppliedToDto;
  @ApiProperty({ type: () => [FeedPlanLineResponseDto] })
  lines!: FeedPlanLineResponseDto[];
  @ApiProperty() total_kg_per_day!: number;
  @ApiProperty(DATE_TIME) created_at!: Date;
  @ApiProperty(DATE_TIME) updated_at!: Date;
}

export class FeedPlanArchiveResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() archived!: boolean;
  @ApiProperty() removed_assignments!: number;
}

// ─── Plan assignments ──────────────────────────────────────────────────────

export class FeedPlanAssignmentBaseDto {
  @ApiProperty() id!: string;
  @ApiProperty() plan_id!: string;
  @ApiProperty({ enum: FeedPlanTarget, enumName: 'FeedPlanTarget' })
  target_type!: FeedPlanTarget;
  @ApiProperty(NULLABLE_STRING) cattle_id!: string | null;
  @ApiProperty(NULLABLE_STRING) animal_group_id!: string | null;
  @ApiProperty(DATE_TIME) applied_at!: Date;
  @ApiProperty() applied_by!: string;
  @ApiProperty({ ...DATE_TIME, nullable: true }) removed_at!: Date | null;
  @ApiProperty(NULLABLE_STRING) removed_by!: string | null;
}

export class FeedPlanAssignmentNamedDto extends FeedPlanAssignmentBaseDto {
  @ApiProperty() plan_name!: string;
}

export class FeedPlanAssignmentListItemDto extends FeedPlanAssignmentNamedDto {
  @ApiProperty({ enum: FeedPlanKind, enumName: 'FeedPlanKind' })
  plan_kind!: FeedPlanKind;
}

export class LeavesGroupProgramDto {
  @ApiProperty() cattle_id!: string;
  @ApiProperty(NULLABLE_STRING) group_id!: string | null;
  @ApiProperty() plan_id!: string;
  @ApiProperty() plan_name!: string;
}

export class ApplyFeedPlanResponseDto {
  @ApiProperty() plan_id!: string;
  @ApiProperty({ type: () => [FeedPlanAssignmentBaseDto] })
  assignments!: FeedPlanAssignmentBaseDto[];
  @ApiProperty({
    type: () => [FeedPlanAssignmentNamedDto],
    description: 'Earlier assignments this apply replaced.',
  })
  replaced!: FeedPlanAssignmentNamedDto[];
  @ApiProperty({ type: () => [LeavesGroupProgramDto] })
  leaves_group_program!: LeavesGroupProgramDto[];
}

// ─── Distributions ─────────────────────────────────────────────────────────

export class FeedDistributionLineDto {
  @ApiProperty() ingredient_id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() planned_kg!: number;
  @ApiProperty() actual_kg!: number;
  @ApiProperty() refusal_kg!: number;
  @ApiProperty() price_per_kg!: number;
  @ApiProperty() line_cost!: number;
}

export class FeedDistributionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty(NULLABLE_STRING) concentration_id!: string | null;
  @ApiProperty(NULLABLE_STRING) cattle_id!: string | null;
  @ApiProperty(DATE_TIME) distributed_at!: Date;
  @ApiProperty() total_planned_kg!: number;
  @ApiProperty() total_actual_kg!: number;
  @ApiProperty() total_refusal_kg!: number;
  @ApiProperty() total_planned_cost!: number;
  @ApiProperty() total_actual_cost!: number;
  @ApiProperty(NULLABLE_STRING) notes!: string | null;
  @ApiProperty(NULLABLE_NUMBER) forage_decrements!: number | null;
  @ApiProperty({ type: () => [FeedDistributionLineDto] })
  items!: FeedDistributionLineDto[];
  @ApiProperty(DATE_TIME) created_at!: Date;
}

export class FeedDistributionListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty(NULLABLE_STRING) concentration_id!: string | null;
  @ApiProperty(NULLABLE_STRING) cattle_id!: string | null;
  @ApiProperty(DATE_TIME) distributed_at!: Date;
  @ApiProperty() total_actual_kg!: number;
  @ApiProperty() total_actual_cost!: number;
  @ApiProperty(DATE_TIME) created_at!: Date;
}

export class FeedCostTrendPointDto {
  @ApiProperty({ description: 'Calendar day, YYYY-MM-DD.' }) date!: string;
  @ApiProperty() total_cost!: number;
}

export class FeedCostSummaryDto {
  @ApiProperty() days!: number;
  @ApiProperty() total_cost!: number;
  @ApiProperty(NULLABLE_NUMBER) cost_per_cow_per_day!: number | null;
  @ApiProperty(NULLABLE_NUMBER) cost_per_litre!: number | null;
  @ApiProperty() headcount!: number;
  @ApiProperty() total_litres!: number;
  @ApiProperty({ type: () => [FeedCostTrendPointDto] })
  trend!: FeedCostTrendPointDto[];
}

export class FeedProgramRefDto {
  @ApiProperty() plan_id!: string;
  @ApiProperty() plan_name!: string;
  @ApiProperty({
    enum: ['INDIVIDUAL', 'GROUP', 'HERD'],
    enumName: 'FeedProgramVia',
  })
  via!: ProgramVia;
  @ApiProperty() conflict!: boolean;
}

export class FeedDmiComparisonDto {
  @ApiProperty() expected_dmi_kg!: number;
  @ApiProperty(NULLABLE_NUMBER) actual_dmi_kg!: number | null;
  @ApiProperty(NULLABLE_NUMBER) delta_pct!: number | null;
  @ApiProperty(NULLABLE_STRING) match_level!: string | null;
  @ApiProperty({ type: () => FeedProgramRefDto, nullable: true })
  program!: FeedProgramRefDto | null;
}

export class FeedEfficiencyDto {
  @ApiProperty() distributions!: number;
  @ApiProperty() planned_kg!: number;
  @ApiProperty() actual_kg!: number;
  @ApiProperty() refusal_kg!: number;
  @ApiProperty() consumed_kg!: number;
  @ApiProperty() planned_cost!: number;
  @ApiProperty() actual_cost!: number;
  @ApiProperty(NULLABLE_NUMBER) adherence_pct!: number | null;
  @ApiProperty(NULLABLE_NUMBER) refusal_pct!: number | null;
  @ApiProperty() litres_produced!: number;
  @ApiProperty(NULLABLE_NUMBER) feed_cost_per_litre!: number | null;
  @ApiProperty() cattle_id!: string;
  @ApiProperty() cattle_name!: string;
  @ApiProperty() period!: string;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
// Each fails `nest build` if the service's real return type and the documented class diverge.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Ret<S, K extends keyof S> = S[K] extends (...args: never[]) => infer R
  ? Awaited<R>
  : never;

type Stock = FeedStockService;
type Plan = FeedPlanService;
type Assign = FeedPlanAssignmentService;
type Dist = FeedDistributionService;
type Ingr = FeedIngredientService;

export type FeedShapeGuards = [
  // stock
  Assert<Same<Ret<Stock, 'list'>, FeedStockResponseDto[]>>,
  Assert<Same<Ret<Stock, 'get'>, FeedStockDetailResponseDto>>,
  Assert<Same<Ret<Stock, 'archive'>, FeedStockResponseDto>>,
  Assert<Same<Ret<Stock, 'updateNutrition'>, FeedStockResponseDto>>,
  Assert<Same<Ret<Stock, 'removeMany'>, BulkDeleteResponseDto>>,
  Assert<
    Same<Ret<FeedConcentrationService, 'removeMany'>, BulkDeleteResponseDto>
  >,
  // plans
  Assert<Same<Ret<Plan, 'create'>, FeedPlanResponseDto>>,
  Assert<Same<Ret<Plan, 'update'>, FeedPlanResponseDto>>,
  Assert<Same<Ret<Plan, 'get'>, FeedPlanResponseDto>>,
  Assert<Same<Ret<Plan, 'list'>, CursorPage<FeedPlanResponseDto>>>,
  Assert<Same<Ret<Plan, 'archive'>, FeedPlanArchiveResponseDto>>,
  // plan assignments
  Assert<Same<Ret<Assign, 'apply'>, ApplyFeedPlanResponseDto>>,
  Assert<Same<Ret<Assign, 'list'>, CursorPage<FeedPlanAssignmentListItemDto>>>,
  Assert<Same<Ret<Assign, 'remove'>, FeedPlanAssignmentNamedDto>>,
  // distributions
  Assert<Same<Ret<Dist, 'create'>, FeedDistributionResponseDto>>,
  Assert<Same<Ret<Dist, 'get'>, FeedDistributionResponseDto>>,
  Assert<Same<Ret<Dist, 'patchRefusal'>, FeedDistributionResponseDto>>,
  Assert<Same<Ret<Dist, 'list'>, CursorPage<FeedDistributionListItemDto>>>,
  Assert<Same<Ret<Dist, 'getFarmFeedCostSummary'>, FeedCostSummaryDto>>,
  Assert<Same<Ret<Dist, 'getDmiComparison'>, FeedDmiComparisonDto>>,
  Assert<Same<Ret<Dist, 'efficiency'>, FeedEfficiencyDto>>,
  // ingredients
  Assert<Same<Ret<Ingr, 'listMerged'>, FeedIngredientResponseDto[]>>,
  Assert<Same<Ret<Ingr, 'listPaged'>, CursorPage<FeedIngredientResponseDto>>>,
  Assert<Same<Ret<Ingr, 'setOverride'>, FeedIngredientOverrideResponseDto>>,
  Assert<Same<Ret<Ingr, 'resetOverride'>, ResetOverrideResponseDto>>,
  Assert<Same<Ret<Ingr, 'createCustom'>, FeedIngredientResponseDto>>,
  Assert<Same<Ret<Ingr, 'updateCustomIngredient'>, FeedIngredientResponseDto>>,
  Assert<
    Same<Ret<Ingr, 'deactivateCustomIngredient'>, FeedIngredientResponseDto>
  >,
];
