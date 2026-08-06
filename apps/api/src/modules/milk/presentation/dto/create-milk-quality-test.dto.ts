import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MilkQualityTestSource } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** `POST /milk/quality-tests` — record one cow's lab/device composition reading. */
export class CreateMilkQualityTestDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  cattleId!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  lactationId!: string;

  @IsDateString()
  sampleDate!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  @Max(100)
  fatPct!: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  @Max(100)
  proteinPct!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsNumber()
  @Min(0)
  @Max(100)
  lactosePct?: number;

  /** Cells per mL. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsNumber()
  @Min(0)
  somaticCellCount?: number;

  /** mg/dL. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? value : Number(value),
  )
  @IsNumber()
  @Min(0)
  milkUreaNitrogen?: number;

  @IsEnum(MilkQualityTestSource)
  source!: MilkQualityTestSource;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
