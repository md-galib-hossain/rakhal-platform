import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare const trimString: ({ value }: {
    value: unknown;
}) => unknown;
export declare const toBoolean: ({ value }: {
    value: unknown;
}) => unknown;
export declare class ReproductionListQueryDto extends CursorPaginationQueryDto {
    cattleId?: string;
    fromDate?: string;
    toDate?: string;
}
export declare class BooleanSymptomsDto {
    standingHeat?: boolean;
    mucusDischarge?: boolean;
    mountingBehavior?: boolean;
    restlessness?: boolean;
}
