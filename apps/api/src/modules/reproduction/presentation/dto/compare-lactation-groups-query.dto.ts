import { IsIn } from 'class-validator';
import type { LactationComparisonGroupBy } from '../../domain/lactation-comparison';

const GROUP_BY_VALUES: LactationComparisonGroupBy[] = [
  'parity',
  'shed',
  'dimRange',
];

/**
 * Query for `GET /reproduction/lactations/compare/groups` (RAKHAL-287) —
 * farm-level average yield/peak/persistency, bucketed by `groupBy`:
 * `parity` (lactation-number bucket, 4+ pooled), `shed` (from `Cattle`),
 * or `dimRange` (days-in-milk band).
 */
export class CompareLactationGroupsQueryDto {
  @IsIn(GROUP_BY_VALUES)
  groupBy!: LactationComparisonGroupBy;
}
