import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { FeedClass } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { toBoolean, trimString } from 'src/common/dto';

/** Query for `GET /feed/ingredients` — cursor-paginated (RAKHAL, 2026-08-14 pagination/filtering
 * follow-up to RAKHAL-310's `includeArchived`), with search + feed-class + price-range filters.
 * `feedClass` accepts comma-separated values (`?feedClass=FORAGE,MINERAL`) for the multi-select
 * filter (2026-08-15, reusable FilterBar checklist follow-up) — matched with an `in`, not `=`. */
export class ListIngredientsQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value?: string }) =>
    value ? value.split(',').filter(Boolean) : undefined,
  )
  @IsArray()
  @IsEnum(FeedClass, { each: true })
  feedClass?: FeedClass[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived = false;
}
