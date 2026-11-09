import { FixedAssetCategory } from '@prisma/client';
export declare class CreateFixedAssetDto {
    name: string;
    category?: FixedAssetCategory;
    description?: string;
    purchaseDate: string;
    purchasePrice: number;
    usefulLifeYears?: number;
    salvageValue?: number;
}
