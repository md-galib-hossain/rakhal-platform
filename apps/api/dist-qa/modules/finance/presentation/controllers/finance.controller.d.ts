import { FinanceService } from '../../application/services/finance.service';
import { CreateFixedAssetDto } from '../dto/create-fixed-asset.dto';
export declare class FinanceController {
    private readonly financeService;
    constructor(financeService: FinanceService);
    liabilities(farmId: string): Promise<{
        stats: {
            totalDebt: number;
            monthlyEmi: number;
        };
        loans: {
            id: string;
            entityName: string;
            total: number;
            paid: number;
            outstanding: number;
            monthlyEmi: number;
            status: import("@prisma/client").$Enums.LoanStatus;
        }[];
    }>;
    assets(farmId: string): Promise<{
        allocation: {
            category: string;
            value: number;
            color: string;
        }[];
        totalAssets: number;
        totalLiabilities: number;
        totalNetWorth: number;
        depreciation: {
            asset_name: string;
            book_value: number;
            accumulated_depreciation: number;
            useful_life_years: number;
            purchase_value: number;
        }[];
    }>;
    createAsset(farmId: string, userId: string, dto: CreateFixedAssetDto): Promise<{
        assetId: string;
        name: string;
        category: import("@prisma/client").$Enums.FixedAssetCategory;
    }>;
}
