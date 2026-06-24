import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { trimString } from 'src/common/dto';

/** `POST /milk/anomalies/:id/review` — manager marks an anomaly reviewed. */
export class ReviewAnomalyDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  action!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
