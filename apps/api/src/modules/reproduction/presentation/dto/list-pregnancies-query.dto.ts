import { IsEnum, IsOptional } from 'class-validator';
import { PregnancyStatus } from '@prisma/client';
import { ReproductionListQueryDto } from './common.dto';

/** `GET /reproduction/pregnancies` — adds an optional `status` filter on top of the shared
 * cursor/cattleId/date-range query, e.g. `status=ACTIVE` for an "eligible for calving" picker. */
export class ListPregnanciesQueryDto extends ReproductionListQueryDto {
  @IsOptional()
  @IsEnum(PregnancyStatus)
  status?: PregnancyStatus;
}
