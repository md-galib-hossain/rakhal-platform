import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from 'src/common/dto';

export class UpdateFeedGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimString)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trimString)
  description?: string;
}
