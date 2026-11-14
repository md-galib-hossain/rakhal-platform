import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { AnimalHoldType } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { toBoolean } from 'src/common/dto';

/** Query for `GET /cattle/:cattleId/holds` (RAKHAL-280) — cursor-paginated. */
export class ListAnimalHoldQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsEnum(AnimalHoldType)
  type?: AnimalHoldType;

  /** Include already-released holds (default false — active only). */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeReleased = false;
}
