import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/** Create a custom (farm-scoped) role. Inherits a base role's grants unless `permission_keys` is given. */
export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(trimString)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(trimString)
  description?: string;

  /** Base system role to seed permissions from. Defaults to `worker`. */
  @IsOptional()
  @IsString()
  @IsIn(['owner', 'manager', 'worker'])
  base_role?: 'owner' | 'manager' | 'worker';

  /** Explicit grant set (catalogue keys). Overrides `base_role` inheritance when present. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permission_keys?: string[];
}
