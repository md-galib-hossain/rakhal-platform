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

  // MILESTONE 28b (RAKHAL-464, D18): the rest of the profile. Optional so a v1 client (DM/CP/ME only) keeps
  // working; the new frontend always sends all of them. Coarse bounds here — the real rules (each mass below DM,
  // NDF max ≥ NDF, Ca + P below DM …) live in `validateManualValues`, which the service runs.

  /** NDF minimum, kg/day. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
  ndfKg?: number;

  /** NDF maximum, kg/day. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
  ndfMaxKg?: number;

  /** ADF minimum, kg/day. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
  adfKg?: number;

  /** Fat, kg/day. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
  fatKg?: number;

  /** Total digestible nutrients, kg/day. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
  tdnKg?: number;

  /** Calcium, kg/day. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
  calciumKg?: number;

  /** Phosphorus, kg/day. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
  phosphorusKg?: number;

  /** Rumen-degradable protein, % of crude protein. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rdpPct?: number;

  /** Rumen-undegradable protein, % of crude protein. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rupPct?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(300)
  note?: string;
}
