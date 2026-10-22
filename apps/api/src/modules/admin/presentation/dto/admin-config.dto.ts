import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from 'src/common/dto';
import { CONFIG_KEY_PATTERN } from '../../domain/platform-config';

const KEY_MESSAGE =
  'key must be lower-case, start with a letter and be 3-64 characters of a-z 0-9 _ . -';

/** Every config change states why; it lands in the audit trail. */
export class ConfigReasonDto {
  @Transform(trimString)
  @IsString()
  @MinLength(10, { message: 'reason must be at least 10 characters' })
  @MaxLength(500)
  reason!: string;
}

export class CreateFlagDto extends ConfigReasonDto {
  @IsString()
  @Matches(CONFIG_KEY_PATTERN, { message: KEY_MESSAGE })
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  farmIds?: string[];
}

export class UpdateFlagDto extends ConfigReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  farmIds?: string[];
}

export class SetSettingDto extends ConfigReasonDto {
  /** Any JSON value (size-limited, secrets refused in the service). */
  @IsDefined()
  value!: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}

export class RetryJobDto extends ConfigReasonDto {}
