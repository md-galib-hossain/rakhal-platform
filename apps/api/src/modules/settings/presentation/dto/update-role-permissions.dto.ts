import { ArrayUnique, IsArray, IsString } from 'class-validator';

/** Replace a custom role's grant set with the given catalogue keys. */
export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permission_keys!: string[];
}
