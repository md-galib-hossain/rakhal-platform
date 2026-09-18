import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/**
 * Restock an existing `Medicine` product with a new lot (RAKHAL-434/435,
 * `docs/EPIC_MEDICINE_BATCH_MODEL.md`) — `POST /inventory/medicines/:id/batches`.
 * Product-level fields (name/category/manufacturer/unit/thresholds) live on the
 * parent `Medicine` and are not repeated here.
 */
export class CreateMedicineBatchDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  batchCode?: string;

  @IsNumber()
  @Min(0)
  currentStock!: number;

  @IsNumber()
  @Min(0)
  costPerUnit!: number;

  @IsISO8601()
  purchaseDate!: string;

  @IsISO8601()
  expiryDate!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
