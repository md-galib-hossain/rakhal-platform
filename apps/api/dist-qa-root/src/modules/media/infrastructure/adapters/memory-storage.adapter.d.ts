import { GetObjectOptions, ObjectStoragePort, PutObjectInput } from '../../application/ports/object-storage.port';
export declare class MemoryStorageAdapter implements ObjectStoragePort {
    readonly provider = "memory";
    private static readonly store;
    isConfigured(): boolean;
    put(input: PutObjectInput): Promise<void>;
    getSignedUrl(key: string, expirySeconds: number): Promise<string>;
    get(key: string, opts?: GetObjectOptions): Promise<Buffer>;
    delete(key: string): Promise<void>;
}
