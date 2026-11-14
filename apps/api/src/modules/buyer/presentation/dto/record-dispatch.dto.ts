import { PaymentMethod } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/** `POST /milk/dispatch` — record milk handed to a buyer (PRD §11.2). */
export class RecordDispatchDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  buyerId!: string;

  @IsDateString()
  dispatchedAt!: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  volumeDispatchedL!: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  volumeReceivedL?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  fatPct?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  scc?: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  driverName?: string;

  /** Money handed over at the point of sale. Omitted/0 = sold on credit (the
   * buyer's payment terms set the due date). Capped by the server at the sale
   * total; the payment posts in the same transaction as the sale. */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  amountReceived?: number;

  /** Required whenever `amountReceived` > 0 (checked in the use case). */
  @IsOptional()
  @IsIn(Object.values(PaymentMethod))
  paymentMethod?: PaymentMethod;

  /** Optional: a farm has one account and the server uses it when omitted. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  financialAccountId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  referenceNumber?: string;
}
