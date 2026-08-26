import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { trimString } from 'src/common/dto';

/**
 * `POST /sales/animal/:cattleId` (RAKHAL-357/399) — the real HTTP entry
 * point for `SellAnimalUseCase` (RAKHAL-345), which the use case's own
 * `SellAnimalInput` doc comment already flagged as pending. Mirrors that
 * interface's shape 1:1 with class-validator decorators.
 */
export class SellAnimalDto {
  @IsNumber()
  @IsPositive()
  salePrice!: number;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  buyerName?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  buyerId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  financialAccountId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountReceived?: number;

  @IsDateString()
  saleDate!: string;
}
