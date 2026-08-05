import { Transform } from 'class-transformer';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { AnimalHoldType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** Body for `POST /cattle/:cattleId/holds` (RAKHAL-280). */
export class CreateAnimalHoldDto {
  @IsEnum(AnimalHoldType)
  type!: AnimalHoldType;

  @IsString()
  @Transform(trimString)
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}
