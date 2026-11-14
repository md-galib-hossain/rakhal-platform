import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { toBoolean, trimString } from 'src/common/dto';

/**
 * Optional column-mapping for the import preview (RAKHAL-043 / PRD §8.4):
 * a JSON string mapping a canonical field name → the CSV header to read it from
 * (e.g. `{"tag":"Tag No","name":"Cow Name"}`). Sent as a multipart text field.
 */
export class ImportPreviewDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  mapping?: string;
}

/** Confirm a previewed import (RAKHAL-043). `POST /cattle/import/confirm`. */
export class ImportConfirmDto {
  @Transform(trimString)
  @IsString()
  importSessionId!: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  skipErrors = false;
}
