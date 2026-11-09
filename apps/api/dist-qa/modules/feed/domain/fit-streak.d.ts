export interface FitDayRow {
    cattleId: string;
    date: string;
    severity: 'OK' | 'WARN' | 'BAD';
    estimated: boolean;
}
export declare function streakDates(endYmd: string, days: number): string[];
export declare function offTargetCows(rows: FitDayRow[], dates: string[]): string[];
