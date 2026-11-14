import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

/** `POST /inventory/medicines/bulk-delete` — multi-select delete (bulk-action dock, 2026-07-21);
 * soft-deletes every id that belongs to the caller's farm and is still active, silently ignoring
 * any id that doesn't (another farm's row, already-archived, or unknown) rather than erroring the
 * whole batch — same contract as Feed Formulator's `BulkDeleteConcentrationDto`. */
export class BulkDeleteMedicineDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
