import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

const toNumber = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === '' ? value : Number(value);

/** `GET /feed/requirements` query (PRD §12.4, RAKHAL-081). */
export class FeedRequirementsQueryDto {
  @Transform(toNumber)
  @IsNumber()
  @Min(1)
  @Max(2000)
  weightKg!: number;

  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  @Max(100)
  milkTargetL!: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  @Max(15)
  milkFatPct?: number;
}
