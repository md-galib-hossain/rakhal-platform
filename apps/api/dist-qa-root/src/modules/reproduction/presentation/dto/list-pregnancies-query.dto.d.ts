import { PregnancyStatus } from '@prisma/client';
import { ReproductionListQueryDto } from './common.dto';
export declare class ListPregnanciesQueryDto extends ReproductionListQueryDto {
    status?: PregnancyStatus;
}
