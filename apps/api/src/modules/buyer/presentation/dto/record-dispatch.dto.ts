import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/** `POST /milk/dispatch` — record milk handed to a buyer (PRD §11.2). */
export class RecordDispatchDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  buyerId!: string;

  @IsDateString()
  dispatchedAt!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  volumeDispatchedL!: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  volumeReceivedL?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  fatPct?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  scc?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  driverName?: string;
}
