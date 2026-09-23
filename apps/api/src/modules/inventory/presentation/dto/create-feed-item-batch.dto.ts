import { Transform, Type } from 'class-transformer';
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { trimString } from 'src/common/dto';
import { NutritionInputDto } from './nutrition-input.dto';

/**
 * Restock: add a new lot to an existing feed item (MILESTONE 26, RAKHAL-444). Lots are never blended —
 * a restock of different quality is its own batch with its own nutrition. Nutrition defaults to the
 * item's current default profile when neither `nutrition` nor `copyFromIngredientId` is given.
 */
export class CreateFeedItemBatchDto {
  @IsNumber()
  @Min(0)
  currentStock!: number;

  @IsNumber()
  @Min(0)
  costPerUnit!: number;

  @IsISO8601()
  purchaseDate!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  batchCode?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NutritionInputDto)
  nutrition?: NutritionInputDto;

  /** Copy this lot's nutrition once from a Rakhal catalogue ingredient (no live link kept). */
  @IsOptional()
  @IsString()
  copyFromIngredientId?: string;
}
