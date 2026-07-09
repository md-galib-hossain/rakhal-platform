import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { trimString } from 'src/common/dto';

/** `GET /search?q=&limit=` (RAKHAL-257). */
export class SearchQueryDto {
  @Transform(trimString)
  @IsString()
  q!: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
