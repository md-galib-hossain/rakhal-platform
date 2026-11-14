import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { trimString } from 'src/common/dto';

/**
 * `GET /inventory/medicines/by-batch-code` (RAKHAL-434 problem #2 / RAKHAL-439)
 * — real batch lookup across the whole farm (a manufacturer recall: "show me
 * every remaining vial tagged LOT-4471", regardless of which product it's
 * under), not a bare per-row text `contains`.
 */
export class MedicineByBatchCodeQueryDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  code!: string;
}
