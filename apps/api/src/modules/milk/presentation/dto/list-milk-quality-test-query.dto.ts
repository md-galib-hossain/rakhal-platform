import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { trimString } from 'src/common/dto';

/** Query for `GET /milk/quality-tests` — farm-scoped, cursor-paginated. */
export class ListMilkQualityTestQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  lactationId?: string;
}

/** Query for `GET /milk/quality-tests/latest` — one cow's most recent test. */
export class LatestMilkQualityTestQueryDto {
  @Transform(trimString)
  @IsString()
  cattleId!: string;
}
