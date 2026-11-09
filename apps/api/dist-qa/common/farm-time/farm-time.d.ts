export declare const DEFAULT_FARM_TIMEZONE = "Asia/Dhaka";
export declare function isValidTimezone(timezone: string): boolean;
export declare function localDateIso(timezone?: string, now?: Date): string;
export declare function dayKey(dateStr: string): Date;
export declare function localDayStart(timezone?: string, now?: Date): Date;
export declare function zonedToUtc(timezone: string, ymd: string, hm?: string): Date;
