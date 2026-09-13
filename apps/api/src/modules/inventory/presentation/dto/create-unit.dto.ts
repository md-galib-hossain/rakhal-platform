import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { UnitDimension } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** Create a farm-custom unit (RAKHAL-326). Tenant (`farmId`) comes from the token —
 * never accepted in the body. Only used when the seeded system catalog doesn't already
 * cover a farm's unit (`GET /inventory/units` should be searched first). */
export class CreateUnitDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  symbol!: string;

  @IsEnum(UnitDimension)
  dimension!: UnitDimension;

  /** Conversion to this dimension's base unit (kg for WEIGHT, L for VOLUME) — required for
   * those two dimensions (otherwise every downstream kg-math consumer, e.g.
   * `resolveKgPerUnit()`, would silently have no factor to resolve). Must be omitted for
   * COUNT, which has no inherent weight/volume. */
  @ValidateIf((dto: CreateUnitDto) => dto.dimension !== UnitDimension.COUNT)
  @IsNumber()
  @Min(0)
  conversionToBase?: number;
}
