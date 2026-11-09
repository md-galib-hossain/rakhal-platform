export declare const LATE_WINDOW_MS: number;
export type LateVerdict = 'FIRE' | 'LATE';
export declare function evaluateLate(fireAt: Date, now: Date): LateVerdict;
