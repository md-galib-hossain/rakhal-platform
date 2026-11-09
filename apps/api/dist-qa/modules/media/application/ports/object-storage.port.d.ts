export declare const OBJECT_STORAGE: unique symbol;
export interface GetObjectOptions {
    maxBytes?: number;
}
export declare class StorageObjectTooLargeError extends Error {
    readonly key: string;
    readonly maxBytes: number;
    constructor(key: string, maxBytes: number);
}
export interface PutObjectInput {
    key: string;
    body: Buffer;
    contentType: string;
}
export interface ObjectStoragePort {
    readonly provider: string;
    isConfigured(): boolean;
    put(input: PutObjectInput): Promise<void>;
    getSignedUrl(key: string, expirySeconds: number): Promise<string>;
    get(key: string, opts?: GetObjectOptions): Promise<Buffer>;
    delete(key: string): Promise<void>;
}
