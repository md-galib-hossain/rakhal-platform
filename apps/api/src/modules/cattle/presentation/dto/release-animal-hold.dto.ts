import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from 'src/common/dto';

/** Body for `PATCH /cattle/:cattleId/holds/:holdId/release` (RAKHAL-280). */
export class ReleaseAnimalHoldDto {
  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(500)
  note?: string;
}
