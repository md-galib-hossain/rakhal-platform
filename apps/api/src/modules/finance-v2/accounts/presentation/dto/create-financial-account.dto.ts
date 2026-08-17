import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { FinancialAccountType, MfsProvider } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** Required when `CreateFinancialAccountDto.type === 'BANK'`. */
export class CreateBankAccountDetailDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  bankName!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  accountNumber!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  branch?: string;
}

/** Required when `CreateFinancialAccountDto.type === 'MFS'`. `provider` (bKash/Nagad/...)
 * is a provider, not an account type — do not confuse with `FinancialAccountType`. */
export class CreateMfsAccountDetailDto {
  @IsEnum(MfsProvider)
  provider!: MfsProvider;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  /** Free text, e.g. "personal"/"merchant" — providers don't share a fixed enum here. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  accountType?: string;
}

/**
 * `POST /finance/accounts` (RAKHAL-335, `FINANCE_V2_DESIGN.md` §3, §4.4). Tenant
 * (`farmId`) comes from the access token via `FarmContextGuard` — never accepted
 * in the body.
 *
 * A non-zero `openingBalance` posts a real journal transaction (this account's
 * ledger account debited, Opening Balance Equity credited) — it is never a
 * direct balance assignment, since `FinancialAccount` has no `balance` column.
 */
export class CreateFinancialAccountDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(FinancialAccountType)
  type!: FinancialAccountType;

  /** Single currency today (BDT/৳) — see `FINANCE_V2_DESIGN.md` §2.1. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  openingBalance?: number;

  @ValidateIf(
    (o: CreateFinancialAccountDto) => o.type === FinancialAccountType.BANK,
  )
  @ValidateNested()
  @Type(() => CreateBankAccountDetailDto)
  bankDetail?: CreateBankAccountDetailDto;

  @ValidateIf(
    (o: CreateFinancialAccountDto) => o.type === FinancialAccountType.MFS,
  )
  @ValidateNested()
  @Type(() => CreateMfsAccountDetailDto)
  mfsDetail?: CreateMfsAccountDetailDto;
}
