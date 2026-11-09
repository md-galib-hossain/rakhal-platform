export declare const trimString: ({ value }: {
    value: unknown;
}) => unknown;
export declare const toBoolean: ({ value }: {
    value: unknown;
}) => unknown;
export declare class PaginationQueryDto {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder: 'asc' | 'desc';
    includeArchived: boolean;
}
