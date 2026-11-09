import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListBreedQueryDto extends CursorPaginationQueryDto {
    search?: string;
    includeArchived: boolean;
}
