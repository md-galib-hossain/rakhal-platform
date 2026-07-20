import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

/** `POST /feed/stock/bulk-delete` — multi-select delete (bulk-action dock, 2026-07-21);
 * soft-deletes every id that belongs to the caller's farm and is still active, silently ignoring
 * any id that doesn't — same contract as `BulkDeleteConcentrationDto`. */
export class BulkDeleteStockDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
