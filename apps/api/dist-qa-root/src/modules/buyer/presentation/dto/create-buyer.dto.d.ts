import { BuyerType } from '@prisma/client';
export declare class CreateBuyerDto {
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    buyerType: BuyerType;
    paymentTermsDays?: number;
    basePricePerLitre: number;
    baseFatPct?: number;
    fatBonusPer01Pct?: number;
    sccThreshold?: number;
    sccPenaltyPer100k?: number;
    collectionDays?: string[];
    collectionTime?: string;
    bankDetails?: string;
}
