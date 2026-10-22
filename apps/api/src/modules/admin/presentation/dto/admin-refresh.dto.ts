import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AdminRefreshDto {
  /** The opaque refresh token returned by login / the previous refresh. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  refreshToken!: string;
}
