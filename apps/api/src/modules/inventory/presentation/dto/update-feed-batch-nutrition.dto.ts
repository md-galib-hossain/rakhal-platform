import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { NutritionInputDto } from './nutrition-input.dto';

/** Edit one lot's nutrition (MILESTONE 26, RAKHAL-444). Appends a new immutable profile — never mutates. */
export class UpdateFeedBatchNutritionDto {
  @ValidateNested()
  @Type(() => NutritionInputDto)
  nutrition!: NutritionInputDto;

  /** Optimistic concurrency: the batch `updatedAt` the client last saw. A mismatch returns 409. */
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;

  /** Also make this the item's default for future batches (default true). */
  @IsOptional()
  @IsBoolean()
  makeDefault?: boolean;
}
