import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/** One line's leftover/refusal weigh-in. */
export class RefusalItemDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  ingredientId!: string;

  @IsNumber()
  @Min(0)
  refusalKg!: number;
}

/** `PATCH /feed/distributions/:id/refusal` — next-day leftover weigh-in (2026-08-13, user
 * request: refusal is often only known the next feeding, not at feed time). Replaces each
 * named line's `refusalKg`; lines not mentioned keep their existing value. */
export class PatchRefusalDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => RefusalItemDto)
  items!: RefusalItemDto[];
}
