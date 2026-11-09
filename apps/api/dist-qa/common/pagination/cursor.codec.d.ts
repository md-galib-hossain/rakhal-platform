export interface CursorPayload {
    id: string;
    [key: string]: unknown;
}
export declare function encodeCursor(payload: CursorPayload): string;
export declare function decodeCursor<T extends CursorPayload = CursorPayload>(cursor: string): T;
