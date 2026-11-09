export interface DataQuality {
    coverage: {
        expected: number;
        recorded: number;
    };
    notes: string[];
    flags: DataQualityFlags;
}
export interface DataQualityFlags {
    incompleteCoverage: boolean;
    hasUnsubmittedDrafts: boolean;
    hasEstimatedValues: boolean;
    hasUnknownCosts: boolean;
    groupMembershipCurrentOnly: boolean;
}
