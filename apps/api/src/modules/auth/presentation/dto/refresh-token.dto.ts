import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  farmId!: string;

  /** Native clients only (`X-Client: mobile`): the refresh token returned by login/refresh, sent in the body
   * because there is no cookie jar. Ignored when the refresh cookie is present (browsers). */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  refreshToken?: string;
}
