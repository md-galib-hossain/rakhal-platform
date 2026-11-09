export declare const METRIC_LABELS: Readonly<Record<string, string>>;
export declare const KEY_LABELS: Readonly<Record<string, string>>;
export declare const SOURCE_LABELS: Readonly<Record<string, string>>;
export declare function asText(v: unknown): string;
export declare function humanize(raw: unknown): string;
export declare function metricLabel(metricId: unknown): string;
export declare function keyLabel(key: unknown): string;
export declare function sourceLabel(source: string | null | undefined): string | null;
