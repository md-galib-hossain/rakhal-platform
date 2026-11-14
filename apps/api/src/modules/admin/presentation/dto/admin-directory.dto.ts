import { FarmStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from 'src/common/dto';
import { CursorPaginationQueryDto } from 'src/common/pagination';

/** `GET /admin/farms` — search across name, slug, farm code, phone and owner name/email. */
export class ListAdminFarmsQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(FarmStatus)
  status?: FarmStatus;
}

/** `GET /admin/users` — search across name and email. */
export class ListAdminUsersQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;
}
