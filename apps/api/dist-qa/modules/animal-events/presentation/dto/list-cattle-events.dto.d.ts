export declare const EVENT_GROUPS: readonly ["REPRODUCTION", "HEALTH", "GROWTH", "MOVEMENT", "OTHER"];
export declare class EligibleEventsDto {
    date?: string;
}
export declare class ListCattleEventsDto {
    cursor?: string;
    limit: number;
    includeVoided?: boolean;
    group?: (typeof EVENT_GROUPS)[number];
}
