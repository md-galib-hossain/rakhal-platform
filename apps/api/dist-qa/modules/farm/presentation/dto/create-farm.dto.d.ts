export declare const HERD_SIZE_BANDS: readonly ["10-50", "51-200", "201-500"];
export declare class CreateFarmDto {
    name: string;
    description?: string;
    referralCode?: string;
    division?: string;
    district?: string;
    upazila?: string;
    operationalPurpose?: string;
    herdSizeBand?: string;
    cattleIdPrefix?: string;
}
