import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  farmId!: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;
}
