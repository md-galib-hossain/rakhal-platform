import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from 'src/common/dto';

/** Create a farm (the caller becomes its Owner). Tenant context is established by this call. */
export class CreateFarmDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  description?: string;

  /** Captured `?ref=<code>` at signup (REF-01, RAKHAL-223). Bound once, permanently. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(20)
  referralCode?: string;
}
