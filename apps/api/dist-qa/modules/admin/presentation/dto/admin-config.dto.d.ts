export declare class ConfigReasonDto {
    reason: string;
}
export declare class CreateFlagDto extends ConfigReasonDto {
    key: string;
    description?: string;
    enabled?: boolean;
    farmIds?: string[];
}
export declare class UpdateFlagDto extends ConfigReasonDto {
    description?: string;
    enabled?: boolean;
    farmIds?: string[];
}
export declare class SetSettingDto extends ConfigReasonDto {
    value: unknown;
    description?: string;
}
export declare class RetryJobDto extends ConfigReasonDto {
}
