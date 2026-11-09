import { GetObjectOptions, ObjectStoragePort, PutObjectInput } from '../../application/ports/object-storage.port';
export declare class R2StorageAdapter implements ObjectStoragePort {
    readonly provider = "r2";
    private client?;
    isConfigured(): boolean;
    put(input: PutObjectInput): Promise<void>;
    getSignedUrl(key: string, expirySeconds: number): Promise<string>;
    get(key: string, opts?: GetObjectOptions): Promise<Buffer>;
    delete(key: string): Promise<void>;
    private bucket;
    private getClient;
}
