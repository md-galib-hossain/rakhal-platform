import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { trimString } from 'src/common/dto';

/** `PATCH /buyers/dispatches/:id/receipt` (RAKHAL-378) — confirms the volume
 * actually received, moving a dispatch PENDING → DELIVERED (derived, see
 * `domain/dispatch-status.ts`). `driverName` is settable here too. */
export class RecordReceiptDto {
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  volumeReceivedL!: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  driverName?: string;
}
