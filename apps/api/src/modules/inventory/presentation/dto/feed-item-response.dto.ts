import { ApiProperty } from '@nestjs/swagger';
import { FeedClass, FeedSubType, NutritionSource } from '@prisma/client';
import type { CursorPage } from 'src/common/pagination/cursor-page.type';
import type { FeedItemService } from '../../application/services/feed-item.service';
import type { StockStatus } from '../../domain/medicine-status';
import { UnitResponseDto } from './inventory-response.dto';

/**
 * Documented response shapes for the Inventory feed-item routes (RD-140). Every class mirrors what
 * `FeedItemService` returns and is pinned to it by a compile-time guard at the bottom of this file. This
 * service returns camelCase keys. `Date` fields are ISO-8601 strings on the wire; quantities and costs are
 * plain JSON numbers.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;
const NULLABLE_NUMBER = { type: Number, nullable: true } as const;
const NULLABLE_STRING = { type: String, nullable: true } as const;
const STOCK_STATUS = ['out', 'low', 'adequate'] as const;

/** One nutrition profile (a snapshot of the nutrient figures, % of dry matter). */
export class FeedItemNutritionDto {
  @ApiProperty() id!: string;
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
  @ApiProperty() moisturePct!: number;
  @ApiProperty({ enum: NutritionSource, enumName: 'NutritionSource' })
  nutritionSource!: NutritionSource;
  @ApiProperty(NULLABLE_STRING) sourceRef!: string | null;
  @ApiProperty(NULLABLE_STRING) note!: string | null;
  @ApiProperty(NULLABLE_STRING) supersedesId!: string | null;
  @ApiProperty(NULLABLE_STRING) copiedFromIngredientId!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
}

/** One purchased batch of a feed item with its own nutrition profile. */
export class FeedItemBatchDto {
  @ApiProperty() id!: string;
  @ApiProperty(NULLABLE_STRING) batchCode!: string | null;
  @ApiProperty() currentStock!: number;
  @ApiProperty() costPerUnit!: number;
  @ApiProperty(DATE_TIME) purchaseDate!: Date;
  @ApiProperty(NULLABLE_STRING) notes!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
  @ApiProperty() nutritionProfileId!: string;
  @ApiProperty({ type: () => FeedItemNutritionDto })
  nutrition!: FeedItemNutritionDto;
}

/** A feed item with its batches and the figures rolled up from them. */
export class FeedItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: FeedClass, enumName: 'FeedClass' })
  feedClass!: FeedClass;
  @ApiProperty({ enum: FeedSubType, enumName: 'FeedSubType', nullable: true })
  feedSubType!: FeedSubType | null;
  @ApiProperty(NULLABLE_STRING) ingredientId!: string | null;
  @ApiProperty(NULLABLE_STRING) defaultNutritionProfileId!: string | null;
  @ApiProperty() unitId!: string;
  @ApiProperty(NULLABLE_NUMBER) kgPerUnit!: number | null;
  @ApiProperty() lowStockThreshold!: number;
  @ApiProperty(NULLABLE_STRING) supplier!: string | null;
  @ApiProperty(NULLABLE_STRING) notes!: string | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deletedAt!: Date | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
  @ApiProperty({ type: () => UnitResponseDto }) unit!: UnitResponseDto;
  @ApiProperty({ description: 'Sum of the batches.' }) currentStock!: number;
  @ApiProperty({ description: 'Weighted average over the batches.' })
  costPerUnit!: number;
  @ApiProperty(DATE_TIME) purchaseDate!: Date;
  @ApiProperty(NULLABLE_NUMBER) moisturePct!: number | null;
  @ApiProperty({ enum: STOCK_STATUS, enumName: 'StockStatus' })
  stockStatus!: StockStatus;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Stock converted to kilograms; null when the unit has no kg weight.',
  })
  kgEquivalent!: number | null;
  @ApiProperty({
    type: () => FeedItemNutritionDto,
    nullable: true,
    description: 'The item default profile.',
  })
  nutrition!: FeedItemNutritionDto | null;
  @ApiProperty({ type: () => [FeedItemBatchDto] })
  batches!: FeedItemBatchDto[];
}

/** Item detail: also says which nutrient figures differ from the catalogue ingredient. */
export class FeedItemDetailResponseDto extends FeedItemResponseDto {
  @ApiProperty({
    type: [String],
    nullable: true,
    description:
      'Nutrient keys whose value differs from the linked catalogue ingredient; null when the item is not linked.',
  })
  nutritionDiffersFromCatalogue!:
    | (
        | 'dmPct'
        | 'cpPct'
        | 'meMjPerKgDm'
        | 'fatPct'
        | 'ndfPct'
        | 'adfPct'
        | 'rdpPct'
        | 'rupPct'
        | 'starchPct'
        | 'sugarsPct'
        | 'calciumPct'
        | 'phosphorusPct'
        | 'tdnPct'
      )[]
    | null;
}

export class FeedItemBatchOwnerDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: FeedClass, enumName: 'FeedClass' })
  feedClass!: FeedClass;
  @ApiProperty({ type: () => UnitResponseDto }) unit!: UnitResponseDto;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deletedAt!: Date | null;
}

/** One row of GET /inventory/feed-items/by-batch-code. */
export class FeedItemBatchLookupDto extends FeedItemBatchDto {
  @ApiProperty({ type: () => FeedItemBatchOwnerDto })
  feedItem!: FeedItemBatchOwnerDto;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Ret<K extends keyof FeedItemService> = FeedItemService[K] extends (
  ...args: never[]
) => infer R
  ? Awaited<R>
  : never;

export type FeedItemShapeGuards = [
  Assert<Same<Ret<'create'>, FeedItemResponseDto>>,
  Assert<Same<Ret<'findAll'>, CursorPage<FeedItemResponseDto>>>,
  Assert<Same<Ret<'findOne'>, FeedItemDetailResponseDto>>,
  Assert<Same<Ret<'update'>, FeedItemResponseDto>>,
  Assert<Same<Ret<'createBatch'>, FeedItemResponseDto>>,
  Assert<Same<Ret<'reviseBatchNutrition'>, FeedItemDetailResponseDto>>,
  Assert<Same<Ret<'revertBatchNutrition'>, FeedItemDetailResponseDto>>,
  Assert<Same<Ret<'resyncBatchNutrition'>, FeedItemDetailResponseDto>>,
  Assert<Same<Ret<'archive'>, FeedItemResponseDto>>,
  Assert<Same<Ret<'restore'>, FeedItemResponseDto>>,
  Assert<Same<Ret<'remove'>, FeedItemResponseDto>>,
  Assert<Same<Ret<'findByBatchCode'>, FeedItemBatchLookupDto[]>>,
];
