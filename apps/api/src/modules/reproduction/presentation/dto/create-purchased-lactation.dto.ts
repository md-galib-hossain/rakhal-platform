import { Transform } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

/**
 * RAKHAL-281: start a `Lactation` for a purchased-lactating cow with no
 * `CalvingEvent` on record in this system. `cattleId` comes from the `:id`
 * route param, not the body (RAKHAL convention, matches `CreateDryOffDto`).
 *
 * All fields are optional — a farmer may know none, some, or all of these.
 * Whatever is supplied is stored as-given on `Lactation.estimatedDaysInMilk`/
 * `estimatedLactationNumber`; missing values stay `null`. The resulting
 * `Lactation` is always `isEstimated: true` regardless of which fields are
 * supplied, since there is no `CalvingEvent` backing it in this system.
 */
export class CreatePurchasedLactationDto {
  /** Farmer's best estimate of when this lactation's calving happened
   * (unknown/unverifiable in this system). Used to derive `Lactation.startDate`
   * when `estimatedDaysInMilk` isn't supplied. */
  @IsOptional()
  @IsDateString()
  estimatedCalvingDate?: string;

  /** Known/estimated days-in-milk as of intake — the stronger of the two
   * optional start-date signals when both are supplied (a farmer's DIM
   * estimate is usually more current than a remembered calving date). */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  estimatedDaysInMilk?: number;

  /** Which lactation this is for the cow (e.g. her 3rd). Falls back to the
   * count of existing `Lactation` rows for this cow + 1 when omitted. */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  estimatedLactationNumber?: number;
}
