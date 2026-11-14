import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from 'src/common/dto';

/** `POST /settings/suppliers` (RAKHAL-032). */
export class CreateSupplierDto {
  @IsString()
  @MaxLength(120)
  @Transform(trimString)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimString)
  contact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(trimString)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimString)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimString)
  payment_terms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
