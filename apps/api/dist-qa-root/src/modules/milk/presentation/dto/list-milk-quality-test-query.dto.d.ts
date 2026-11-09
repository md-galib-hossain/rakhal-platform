import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListMilkQualityTestQueryDto extends CursorPaginationQueryDto {
    cattleId?: string;
    lactationId?: string;
}
export declare class LatestMilkQualityTestQueryDto {
    cattleId: string;
}
