import { ArrayUnique, IsArray, IsOptional, IsString } from 'class-validator';

/**
 * Accept legal documents (RAKHAL-236). Omit / empty `documentIds` to accept all
 * current documents (ToS + Privacy) at once — the common signup case.
 */
export class RecordConsentDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  documentIds?: string[];
}
