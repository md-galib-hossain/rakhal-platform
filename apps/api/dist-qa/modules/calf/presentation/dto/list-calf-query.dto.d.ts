import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class ListCalfQueryDto extends CursorPaginationQueryDto {
    stage?: 'newborn' | 'young' | 'pre_weaning' | 'post_weaning';
    healthStatus?: 'healthy' | 'concern';
}
