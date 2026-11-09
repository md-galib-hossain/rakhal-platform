import { ActivityLogModule } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListActivityQueryDto extends CursorPaginationQueryDto {
    module?: ActivityLogModule;
    actorId?: string;
    from?: string;
    to?: string;
    aqrImpactOnly: boolean;
    financialImpactOnly: boolean;
}
