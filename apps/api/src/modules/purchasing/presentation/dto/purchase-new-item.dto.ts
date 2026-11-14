import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  EquipmentType,
  FeedClass,
  FeedSubType,
  MedicineCategory,
  MedicineType,
} from '@prisma/client';
import { trimString } from 'src/common/dto';
import { NutritionInputDto } from 'src/modules/inventory/presentation/dto/nutrition-input.dto';
import { PURCHASE_NEW_ITEM_KINDS } from '../../domain/purchase-line-shape';
import type { PurchaseNewItemKind } from '../../domain/purchase-line-shape';

/**
 * A brand-new inventory item created **inside** a purchase line (Business UX Phase 2) — the
 * alternative to pointing the line at an existing `medicineId`/`feedItemId`/`equipmentId`. The item is
 * created with **zero** stock in the purchase's own transaction; the purchase line then adds the real
 * lot, so stock, ledger (Dr Inventory 1200) and payable stay one atomic unit.
 *
 * Common: `kind`, `name`, `unitId` (optional for EQUIPMENT only). Per kind:
 * - `MEDICINE`: `medicineType` + `medicineCategory` (the line's `expiryDate` is the first lot's expiry).
 * - `FEED`: `feedClass` + either `ingredientId` (copies the catalogue nutrition) or `nutrition`.
 * - `EQUIPMENT`: nothing extra.
 * Fields of another kind are ignored.
 */
export class PurchaseNewItemDto {
  @IsEnum(PURCHASE_NEW_ITEM_KINDS)
  kind!: PurchaseNewItemKind;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;

  /** Unit catalog id (`GET /inventory/units`). Required for MEDICINE and FEED. */
  @ValidateIf(
    (o: PurchaseNewItemDto) => o.kind !== 'EQUIPMENT' || o.unitId !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  unitId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  // ── MEDICINE ──────────────────────────────────────────────────────────
  @ValidateIf((o: PurchaseNewItemDto) => o.kind === 'MEDICINE')
  @IsEnum(MedicineType)
  medicineType?: MedicineType;

  @ValidateIf((o: PurchaseNewItemDto) => o.kind === 'MEDICINE')
  @IsEnum(MedicineCategory)
  medicineCategory?: MedicineCategory;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  milkWithdrawalDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  meatWithdrawalDays?: number;

  // ── FEED ──────────────────────────────────────────────────────────────
  @ValidateIf((o: PurchaseNewItemDto) => o.kind === 'FEED')
  @IsEnum(FeedClass)
  feedClass?: FeedClass;

  @IsOptional()
  @IsEnum(FeedSubType)
  feedSubType?: FeedSubType;

  /** Catalogue ingredient to copy the nutrition from — give this or `nutrition`. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ingredientId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NutritionInputDto)
  nutrition?: NutritionInputDto;

  /** Kg per unit, for bag → kg equivalence. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  kgPerUnit?: number;

  // ── EQUIPMENT ─────────────────────────────────────────────────────────
  @IsOptional()
  @IsEnum(EquipmentType)
  equipmentType?: EquipmentType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  assetId?: string;
}
