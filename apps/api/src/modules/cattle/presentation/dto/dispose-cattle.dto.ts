import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CattleDispositionType } from '@prisma/client';
import { trimString } from './common.dto';

/**
 * `POST /cattle/:id/dispose` (RAKHAL-399). The generic non-monetary exit
 * route — Sold goes through `POST /sales/animal/:cattleId`
 * (`SellAnimalUseCase`, RAKHAL-345/357) instead, since a sale needs a price/
 * buyer/payment the plain disposition record doesn't carry. This route
 * covers `CULL`/`DEATH` (and `TRANSFER`, folded into `SOLD` per RAKHAL-397)
 * directly via `CattleService.recordDisposition` — the single writer of a
 * non-ACTIVE `herdStatus`.
 */
export class DisposeCattleDto {
  @IsEnum(CattleDispositionType)
  type!: CattleDispositionType;

  @IsDateString()
  date!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  reason?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}
