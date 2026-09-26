import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/**
 * `PUT /feed/cattle/:cattleId/requirement-override` — a cow's hand-set requirement (MILESTONE 28, D11).
 * Hard bounds here; `cpKg < dmKg` is checked in the service. No `farmId`, no dates: `effectiveFrom` is always
 * the server's `now()`.
 */
export class SetRequirementOverrideDto {
  /** Dry matter, kg/day. */
  @IsNumber()
  @Min(0.5)
  @Max(40)
  dmKg!: number;

  /** Crude protein, kg/day. */
  @IsNumber()
  @Min(0.01)
  cpKg!: number;

  /** Metabolizable energy, MJ/day. */
  @IsNumber()
  @Min(5)
  @Max(400)
  meMj!: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(300)
  note?: string;
}
