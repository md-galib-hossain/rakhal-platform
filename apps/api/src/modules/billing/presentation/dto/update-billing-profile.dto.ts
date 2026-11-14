import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { trimString } from 'src/common/dto';

/**
 * `PATCH /billing/profile` — the mandatory profile-completion step before a
 * Free-plan checkout can activate (RAKHAL-220 follow-up). Lives on
 * `BillingController` rather than `PATCH /settings/farm` because that route is
 * behind `SubscriptionGuard`, which would block exactly the farms most likely
 * to be here (expired/no-subscription, reactivating via Free).
 */
export class UpdateBillingProfileDto {
  @IsString()
  @Matches(/^01[0-9]{9}$/, {
    message: 'phone must be a valid Bangladeshi mobile number (01XXXXXXXXX)',
  })
  @Transform(trimString)
  phone!: string;

  @IsString()
  @MaxLength(300)
  @Transform(trimString)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trimString)
  farm_name?: string;
}
