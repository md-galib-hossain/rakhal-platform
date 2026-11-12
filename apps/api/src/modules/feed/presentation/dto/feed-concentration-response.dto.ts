import { ApiProperty } from '@nestjs/swagger';
import {
  FeedClass,
  FeedConcentrationKind,
  FeedSubType,
  FeedTargetType,
  type Prisma,
} from '@prisma/client';
import type { FeedConcentrationService } from '../../application/services/feed-concentration.service';
import type { FormulaTotals } from '../../domain/formula-math';
import {
  FeedStockNutritionDto,
  FeedStockResponseDto,
} from './feed-response.dto';

/**
 * Documented response shapes for the concentration (Concentrate Mixer / Feed Mixture) routes, RD-140. Each
 * class mirrors what `FeedConcentrationService` returns and is pinned to it by a compile-time guard at the
 * bottom of this file. Keys are snake_case (hand-built responses); `Date` fields are ISO-8601 strings and
 * quantities are plain JSON numbers.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;
const NULLABLE_NUMBER = { type: Number, nullable: true } as const;
const NULLABLE_STRING = { type: String, nullable: true } as const;

export class ConcentrationTotalsDto {
  @ApiProperty() dm_kg!: number;
  @ApiProperty() cp_kg!: number;
  @ApiProperty() me_mj!: number;
  @ApiProperty() ndf_kg!: number;
  @ApiProperty() fat_kg!: number;
  @ApiProperty() rdp_kg!: number;
  @ApiProperty() rup_kg!: number;
  @ApiProperty() starch_kg!: number;
  @ApiProperty() adf_kg!: number;
  @ApiProperty() calcium_kg!: number;
  @ApiProperty() phosphorus_kg!: number;
  @ApiProperty() tdn_kg!: number;
  @ApiProperty() total_cost_tk!: number;
}

export class ConcentrationRequirementsDto {
  @ApiProperty() dm_kg!: number;
  @ApiProperty() cp_kg!: number;
  @ApiProperty() me_mj!: number;
  @ApiProperty() ndf_kg!: number;
  @ApiProperty() fat_kg!: number;
}

/** One recipe line with its computed nutrient contribution. */
export class ConcentrationLineDto {
  @ApiProperty(NULLABLE_STRING) ingredient_id!: string | null;
  @ApiProperty(NULLABLE_STRING) name!: string | null;
  @ApiProperty() amount_kg!: number;
  @ApiProperty() dm_kg!: number;
  @ApiProperty() cp_kg!: number;
  @ApiProperty() me_mj!: number;
  @ApiProperty() ndf_kg!: number;
  @ApiProperty() fat_kg!: number;
  @ApiProperty() rdp_kg!: number;
  @ApiProperty() rup_kg!: number;
  @ApiProperty() starch_kg!: number;
  @ApiProperty() adf_kg!: number;
  @ApiProperty() calcium_kg!: number;
  @ApiProperty() phosphorus_kg!: number;
  @ApiProperty() tdn_kg!: number;
  @ApiProperty() cost_tk!: number;
  @ApiProperty(NULLABLE_STRING) feed_item_id!: string | null;
  @ApiProperty(NULLABLE_STRING) feed_item_batch_id!: string | null;
  @ApiProperty(NULLABLE_STRING) feed_stock_id!: string | null;
}

/** A concentration without its lines (GET /feed/concentrations items). */
export class ConcentrationSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty({
    enum: FeedConcentrationKind,
    enumName: 'FeedConcentrationKind',
  })
  kind!: FeedConcentrationKind;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: FeedTargetType, enumName: 'FeedTargetType' })
  target_type!: FeedTargetType;
  @ApiProperty(NULLABLE_STRING) cattle_id!: string | null;
  @ApiProperty(NULLABLE_NUMBER) duration_days!: number | null;
  @ApiProperty(NULLABLE_NUMBER) target_weight_kg!: number | null;
  @ApiProperty(NULLABLE_NUMBER) target_milk_l!: number | null;
  @ApiProperty({ type: () => ConcentrationTotalsDto })
  totals!: ConcentrationTotalsDto;
  @ApiProperty(NULLABLE_NUMBER) balance_score!: number | null;
  @ApiProperty({ type: () => ConcentrationRequirementsDto, nullable: true })
  requirements!: ConcentrationRequirementsDto | null;
  @ApiProperty() is_finalized!: boolean;
  @ApiProperty(DATE_TIME) created_at!: Date;
}

/** A concentration with its recipe lines (GET one, create, update). */
export class ConcentrationDetailDto extends ConcentrationSummaryDto {
  @ApiProperty({ type: () => [ConcentrationLineDto] })
  ingredients!: ConcentrationLineDto[];
}

export class ConcentrationRemoveResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'True when archived instead of deleted.' })
  archived!: boolean;
}

export class ConcentrationVersionDto {
  @ApiProperty() id!: string;
  @ApiProperty() version_number!: number;
  @ApiProperty(NULLABLE_STRING) name!: string | null;
  @ApiProperty() total_cost_per_day!: number;
  @ApiProperty(DATE_TIME) created_at!: Date;
}

export class ConcentrationVersionDetailDto extends ConcentrationVersionDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description: 'The frozen recipe lines (JSON).',
  })
  items!: Prisma.JsonValue;
}

export class ConcentrationNormalizeItemDto {
  @ApiProperty(NULLABLE_STRING) ingredient_id!: string | null;
  @ApiProperty(NULLABLE_STRING) feed_item_id!: string | null;
  @ApiProperty() amount_kg!: number;
}

export class ConcentrationNormalizeResponseDto {
  @ApiProperty({ type: () => ConcentrationRequirementsDto })
  requirements!: ConcentrationRequirementsDto;
  @ApiProperty({ type: () => [ConcentrationNormalizeItemDto] })
  items!: ConcentrationNormalizeItemDto[];
  @ApiProperty({ type: () => ConcentrationTotalsDto })
  totals!: ConcentrationTotalsDto;
  @ApiProperty() balance_score!: number;
}

export class ConcentrationFinalizedIngredientDto {
  @ApiProperty() id!: string;
  @ApiProperty() name_en!: string;
  @ApiProperty() is_custom!: boolean;
  @ApiProperty() is_latest_version!: boolean;
  @ApiProperty(NULLABLE_STRING) source_concentration_id!: string | null;
  @ApiProperty(NULLABLE_NUMBER) source_concentration_version!: number | null;
  @ApiProperty() effective_price_per_kg!: number;
  @ApiProperty({ type: () => FeedStockNutritionDto })
  nutrition!: FeedStockNutritionDto;
}

export class ConcentrationFinalizeResponseDto {
  @ApiProperty() concentration_id!: string;
  @ApiProperty({
    type: () => FeedStockResponseDto,
    nullable: true,
    description: 'The produced stock batch.',
  })
  stock!: FeedStockResponseDto | null;
  @ApiProperty({
    type: () => ConcentrationFinalizedIngredientDto,
    nullable: true,
    description: 'The ingredient the finalized mix is published as.',
  })
  ingredient!: ConcentrationFinalizedIngredientDto | null;
  @ApiProperty({
    type: Object,
    nullable: true,
    description: 'Always null: finalize does not post to Finance itself.',
  })
  finance!: null;
}

export class ConcentrationInventoryLineDto {
  @ApiProperty(NULLABLE_STRING) ingredient_id!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty() amount_kg!: number;
  @ApiProperty({ enum: ['IN_INVENTORY', 'MISSING'] })
  status!: 'IN_INVENTORY' | 'MISSING';
  @ApiProperty(NULLABLE_STRING) feed_item_id!: string | null;
  @ApiProperty(NULLABLE_STRING) feed_stock_id!: string | null;
  @ApiProperty(NULLABLE_NUMBER) available_kg!: number | null;
}

export class ConcentrationMissingLineDto {
  @ApiProperty(NULLABLE_STRING) ingredient_id!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty() amount_kg!: number;
  @ApiProperty({ enum: FeedClass, enumName: 'FeedClass', nullable: true })
  feed_class!: FeedClass | null;
  @ApiProperty({
    enum: FeedSubType,
    enumName: 'FeedSubType',
    nullable: true,
  })
  feed_sub_type!: FeedSubType | null;
  @ApiProperty() is_prepared_feed!: boolean;
}

export class ConcentrationShortfallDto {
  @ApiProperty() name!: string;
  @ApiProperty() needed_kg!: number;
  @ApiProperty() available_kg!: number;
}

export class ConcentrationInventoryCheckResponseDto {
  @ApiProperty() can_finalize!: boolean;
  @ApiProperty({ type: () => [ConcentrationInventoryLineDto] })
  lines!: ConcentrationInventoryLineDto[];
  @ApiProperty({ type: () => [ConcentrationMissingLineDto] })
  missing!: ConcentrationMissingLineDto[];
  @ApiProperty({ type: () => [ConcentrationShortfallDto] })
  shortfalls!: ConcentrationShortfallDto[];
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Ret<K extends keyof FeedConcentrationService> =
  FeedConcentrationService[K] extends (...args: never[]) => infer R
    ? Awaited<R>
    : never;
/** The branch of a summary-or-detail union that carries the recipe lines. */
type DetailBranch<T> = Extract<T, { ingredients: unknown }>;

export type FeedConcentrationShapeGuards = [
  Assert<Same<FormulaTotals, ConcentrationTotalsDto>>,
  // `list` / `get` / `create` / `update` return the summary, plus the lines when detailed; the union is
  // pinned branch by branch.
  Assert<Ret<'list'> extends ConcentrationSummaryDto[] ? true : false>,
  Assert<Same<DetailBranch<Ret<'list'>[number]>, ConcentrationDetailDto>>,
  Assert<Ret<'get'> extends ConcentrationSummaryDto ? true : false>,
  Assert<Same<DetailBranch<Ret<'get'>>, ConcentrationDetailDto>>,
  Assert<Ret<'create'> extends ConcentrationSummaryDto ? true : false>,
  Assert<Same<DetailBranch<Ret<'create'>>, ConcentrationDetailDto>>,
  Assert<Ret<'update'> extends ConcentrationSummaryDto ? true : false>,
  Assert<Same<DetailBranch<Ret<'update'>>, ConcentrationDetailDto>>,
  Assert<Same<Ret<'remove'>, ConcentrationRemoveResponseDto>>,
  Assert<Same<Ret<'saveAsVersion'>, ConcentrationVersionDto>>,
  Assert<Same<Ret<'listVersions'>, ConcentrationVersionDetailDto[]>>,
  Assert<Same<Ret<'normalize'>, ConcentrationNormalizeResponseDto>>,
  Assert<Same<Ret<'finalize'>, ConcentrationFinalizeResponseDto>>,
  Assert<Same<Ret<'inventoryCheck'>, ConcentrationInventoryCheckResponseDto>>,
];
