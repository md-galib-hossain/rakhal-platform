import { IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

/** `POST /milk/export` — download a date-range (optionally cow-filtered) milk
 * log as an .xlsx workbook. Omitted/empty `cattleIds` means every cow. */
export class ExportMilkLogDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cattleIds?: string[];
}
