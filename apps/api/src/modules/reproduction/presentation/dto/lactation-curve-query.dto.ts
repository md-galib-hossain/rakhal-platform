import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { trimString } from './common.dto';

/**
 * Query for `GET /reproduction/lactations/:id/curve` (RAKHAL-283). The
 * primary lactation comes from the route param (`:id`); `compareLactationId`
 * optionally requests a second series aligned by DIM (not calendar date) for
 * overlay charting — e.g. current lactation vs. the same cow's previous one.
 */
export class LactationCurveQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  compareLactationId?: string;
}
