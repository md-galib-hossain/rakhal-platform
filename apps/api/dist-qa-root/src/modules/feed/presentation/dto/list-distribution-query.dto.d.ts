import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListDistributionQueryDto extends CursorPaginationQueryDto {
    cattleId?: string;
    concentrationId?: string;
    fromDate?: string;
    toDate?: string;
}
export declare class FeedEfficiencyQueryDto {
    cattleId: string;
    month?: string;
}
