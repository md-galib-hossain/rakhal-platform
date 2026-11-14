import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { MfsProvider } from '@prisma/client';
import { trimString } from 'src/common/dto';

export class UpdateBankAccountDetailDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  bankName?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  accountNumber?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  branch?: string;
}

export class UpdateMfsAccountDetailDto {
  @IsOptional()
  @IsEnum(MfsProvider)
  provider?: MfsProvider;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  phoneNumber?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  accountType?: string;
}

/**
 * `PATCH /finance/accounts/:id` (RAKHAL-335). Only editable fields — `type` and
 * `ledgerAccountId` are immutable after creation and deliberately absent here.
 * `bankDetail`/`mfsDetail` are rejected by the service if supplied for an
 * account whose `type` doesn't carry that detail row.
 */
export class UpdateFinancialAccountDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBankAccountDetailDto)
  bankDetail?: UpdateBankAccountDetailDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateMfsAccountDetailDto)
  mfsDetail?: UpdateMfsAccountDetailDto;
}
