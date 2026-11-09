export declare const CONFIG_KEY_PATTERN: RegExp;
export declare const MAX_SETTING_JSON_BYTES = 4000;
export declare function looksLikeSecretKey(key: string): boolean;
export declare function settingValueProblem(value: unknown): string | null;
export declare function isFeatureEnabled(flag: {
    enabled: boolean;
    farmIds: readonly string[];
} | null | undefined, farmId?: string | null): boolean;
