import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { BalanceService } from 'src/modules/finance-v2/accounts/application/balance.service';
import { CreateFixedAssetDto } from '../../presentation/dto/create-fixed-asset.dto';
export declare class FinanceService {
    private readonly prisma;
    private readonly balanceService;
    private readonly log;
    constructor(prisma: PrismaService, balanceService: BalanceService, logger: LoggerService);
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
    createFixedAsset(farmId: string, userId: string, dto: CreateFixedAssetDto): Promise<{
        assetId: string;
        name: string;
        category: import("@prisma/client").$Enums.FixedAssetCategory;
    }>;
}
