import { IsString, Length } from 'class-validator';

/**
 * Reusable path-param DTO for a single resource id (cuid).
 *
 * Use with a validation-piped param so malformed ids are rejected with a clean
 * VALIDATION_ERROR before hitting the service.
 *
 * @example
 * @Get(':id')
 * findOne(@Param() { id }: IdParamDto) {
 *   return this.service.findOne(id);
 * }
 */
export class IdParamDto {
  @IsString()
  @Length(1, 64)
  id!: string;
}
