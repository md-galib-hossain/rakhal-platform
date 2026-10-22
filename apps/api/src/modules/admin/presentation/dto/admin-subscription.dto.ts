import { BillingPeriod } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { trimString } from 'src/common/dto';

/** Every commercial change states why (audited). */
export class CommercialReasonDto {
  @Transform(trimString)
  @IsString()
  @MinLength(10, { message: 'reason must be at least 10 characters' })
  @MaxLength(500)
  reason!: string;
}

/** Subscription actions also carry the farm name, verified server-side so they cannot hit the wrong farm. */
export class SubscriptionActionDto extends CommercialReasonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  confirm!: string;
}

export class ActivateSubscriptionDto extends SubscriptionActionDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsEnum(BillingPeriod)
  period!: BillingPeriod;
}

export class CompSubscriptionDto extends SubscriptionActionDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsInt()
  @Min(1)
  @Max(365)
  days!: number;
}

export class ExtendSubscriptionDto extends SubscriptionActionDto {
  @IsInt()
  @Min(1)
  @Max(365)
  days!: number;
}

export class UpdatePlanDto extends CommercialReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  monthlyPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000_000)
  yearlyPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  maxCattle?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  maxFarmMembers?: number;
}

export class SetPlanFeatureDto extends CommercialReasonDto {
  @IsBoolean()
  enabled!: boolean;
}
