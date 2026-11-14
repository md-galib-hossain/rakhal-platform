import { ApiProperty } from '@nestjs/swagger';
import type { MilkAvailabilityResult } from '../../application/services/milk-availability.service';

/** One SELLABLE tank's available volume. Documents `MilkTankAvailability`. */
export class MilkTankAvailabilityDto {
  @ApiProperty() tankId!: string;
  @ApiProperty() tankName!: string;
  @ApiProperty({ description: 'Litres available to sell right now.' })
  availableL!: number;
  @ApiProperty() totalCapacityL!: number;
}

/** `GET /milk/availability` payload. Documents `MilkAvailabilityResult`. */
export class MilkAvailabilityResponseDto {
  @ApiProperty({ type: () => [MilkTankAvailabilityDto] })
  tanks!: MilkTankAvailabilityDto[];

  @ApiProperty({ description: 'Sum of `availableL` across the tanks.' })
  totalAvailableL!: number;
}

// Compile-time guard (RD-140): fails `nest build` if the service's return type and this documented
// shape ever diverge, so the OpenAPI file cannot silently drift from what the route really returns.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type MilkAvailabilityShapeGuard = Assert<
  Same<MilkAvailabilityResult, MilkAvailabilityResponseDto>
>;
