export declare const LOGO_MAX_DIMENSION = 4096;
export declare const LOGO_MAX_PIXELS = 16000000;
export declare function isFarmOwnedKey(key: string | null | undefined, farmId: string | null | undefined): boolean;
export declare function readImageSize(buf: Buffer): {
    width: number;
    height: number;
} | null;
export declare function isSafeImageSize(buf: Buffer): boolean;
