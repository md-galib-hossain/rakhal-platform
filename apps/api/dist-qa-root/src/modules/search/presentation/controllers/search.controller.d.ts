import { SearchService } from '../../application/services/search.service';
import { SearchQueryDto } from '../dto/search-query.dto';
export declare class SearchController {
    private readonly search;
    constructor(search: SearchService);
    query(farmId: string, dto: SearchQueryDto): Promise<{
        query: string;
        results: {
            cattle: import("../../application/services/search.service").SearchHit[];
            tasks: import("../../application/services/search.service").SearchHit[];
            suppliers: import("../../application/services/search.service").SearchHit[];
            buyers: import("../../application/services/search.service").SearchHit[];
            sheds: import("../../application/services/search.service").SearchHit[];
            medicines: import("../../application/services/search.service").SearchHit[];
        };
        total: number;
    }>;
}
