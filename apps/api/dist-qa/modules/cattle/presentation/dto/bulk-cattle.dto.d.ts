export declare const BULK_ACTIONS: readonly ["change_shed", "mark_sold", "dispose", "export"];
export type BulkAction = (typeof BULK_ACTIONS)[number];
export declare const BULK_DISPOSE_TYPES: readonly ["SALE", "CULL", "DEATH"];
export type BulkDisposeType = (typeof BULK_DISPOSE_TYPES)[number];
export declare class BulkCattlePayloadDto {
    shedId?: string;
    type?: BulkDisposeType;
    reason?: string;
    date?: string;
}
export declare class BulkCattleDto {
    cattleIds: string[];
    action: BulkAction;
    payload?: BulkCattlePayloadDto;
}
