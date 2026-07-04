import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CouponType } from '@prisma/client';
import { trimString } from 'src/common/dto';

/** Platform-admin coupon issuance (RAKHAL-224, CPN-06, PRD §33.1). */
export class AdminIssueCouponDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsEnum(CouponType)
  type!: CouponType;

  @IsNumber()
  @Min(0)
  value!: number;

  @IsInt()
  @Min(1)
  maxRedemptions!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  perFarmLimit?: number;

  @IsISO8601()
  validFrom!: string;

  @IsISO8601()
  validUntil!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  applicablePlanIds?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  minSpend?: number;
}
