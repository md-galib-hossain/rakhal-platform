import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { trimString } from 'src/common/dto';

export class RefundInvoiceDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(300)
  reason?: string;
}
