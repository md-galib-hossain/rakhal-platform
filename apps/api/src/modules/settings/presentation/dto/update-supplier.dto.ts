import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { trimString } from 'src/common/dto';

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

  /** Archive/restore toggle: send `null` to restore, any non-null value to archive
   * (the server always stamps its own `new Date()` — the client's value is never
   * trusted as the actual timestamp). */
  @IsOptional()
  @ValidateIf((o: UpdateSupplierDto) => o.deleted_at !== null)
  @IsString()
  deleted_at?: string | null;
}
