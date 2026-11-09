export declare function computeMilkRevenue(saleableLitres: number, ratePerLitre: number): number;
export declare function computeDiscardedWithheldValue(withheldLitres: number, discardedLitres: number, ratePerLitre: number): number;
export interface LactationFinancialInputs {
    milkRevenue: number;
    feedCost: number;
    medicineCost: number;
    breedingCost: number;
    discardedWithheldValue: number;
}
export interface LactationFinancialTotals extends LactationFinancialInputs {
    totalCost: number;
    margin: number;
}
export declare function computeLactationMargin(inputs: LactationFinancialInputs): LactationFinancialTotals;
