import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListAnimalGroupQueryDto extends CursorPaginationQueryDto {
    search?: string;
    includeArchived: boolean;
}
