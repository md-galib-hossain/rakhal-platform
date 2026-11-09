export declare function assertYmd(ymd: string): string;
export declare function addDaysYmd(ymd: string, days: number): string;
export declare function diffDaysYmd(a: string, b: string): number;
export declare function isoWeekday(ymd: string): number;
export declare function mondayOf(ymd: string): string;
export declare function parseYmd(ymd: string): {
    y: number;
    m: number;
    d: number;
};
export declare function makeYmd(y: number, m: number, d: number): string;
export declare function daysInMonth(y: number, m: number): number;
export declare function isoWeekOf(ymd: string): {
    year: number;
    week: number;
};
export declare function enumerateYmd(from: string, to: string): string[];
