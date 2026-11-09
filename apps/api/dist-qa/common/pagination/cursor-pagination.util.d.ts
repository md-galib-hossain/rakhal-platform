import { CursorPaginationQueryDto } from './cursor-pagination.dto';
import { CursorPage } from './cursor-page.type';
export interface CursorFindArgs {
    take: number;
    skip?: number;
    cursor?: {
        id: string;
    };
}
export declare function getCursorArgs(query: CursorPaginationQueryDto): CursorFindArgs;
export declare function toCursorPage<T extends {
    id: string;
}>(rows: T[], query: CursorPaginationQueryDto): CursorPage<T>;
