import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
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

/** Cancel a task (user-initiated abandonment, distinct from completing it). */
export class CancelTaskDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;
}
