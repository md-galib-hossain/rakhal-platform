import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { FeedClass, FeedSubType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** `POST /admin/feed-ingredients` (RAKHAL-233 / PRD ADM-13, admin-only — `PlatformAdminGuard`).
 * Creates a new **global catalogue** row (`farmId: null`, `isSystemDefault: true`) — the Rakhal-Admin
 * counterpart to a farm's own quick-add (`POST /feed/ingredients/custom`). Unlike the farm quick-add,
 * DM/CP/ME and price are required here: an admin-authored catalogue entry is expected to carry real
 * lab values, not default to a cost-only placeholder. rdp/rup are % of CP, everything else % of DM
 * (see `FeedIngredient`'s Prisma doc comment). */
export class CreateCatalogueIngredientDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  nameEn!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  nameBn?: string;

  @IsEnum(FeedClass)
  feedClass!: FeedClass;

  @IsOptional()
  @IsEnum(FeedSubType)
  feedSubType?: FeedSubType;

  @IsNumber()
  @Min(0)
  @Max(100)
  dmPct!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  cpPct!: number;

  @IsNumber()
  @Min(0)
  meMjPerKgDm!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  fatPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ndfPct?: number;

  /** % of CP, not % of DM. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rdpPct?: number;

  /** % of CP, not % of DM. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rupPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  starchPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  adfPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  calciumPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  phosphorusPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tdnPct?: number;

  @IsNumber()
  @Min(0)
  currentPricePerKg!: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  nutritionSource?: string;

  @IsOptional()
  @IsBoolean()
  isAvailableBd?: boolean;
}
