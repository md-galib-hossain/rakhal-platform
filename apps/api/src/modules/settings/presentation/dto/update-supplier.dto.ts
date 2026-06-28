import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { toBoolean, trimString } from 'src/common/dto';

/** `PATCH /settings/suppliers/:id` (RAKHAL-032). All fields optional. */
export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trimString)
  name?: string;

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

  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  is_active?: boolean;
}
