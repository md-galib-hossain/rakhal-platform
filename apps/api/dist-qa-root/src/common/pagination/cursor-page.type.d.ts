export interface CursorPageMeta {
    count: number;
    limit: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
}
export interface CursorPage<T> {
    items: T[];
    meta: CursorPageMeta;
}
