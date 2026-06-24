import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { trimString } from 'src/common/dto';

/** Mark a task complete. Optionally attach a proof photo + a note. */
export class CompleteTaskDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  completionPhotoUrl?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}

/** Toggle a single checklist step. */
export class CheckStepDto {
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  completed!: boolean;
}
