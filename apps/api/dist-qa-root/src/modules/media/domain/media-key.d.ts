import { MediaCategory } from '@prisma/client';
export interface MediaKeys {
    full: string;
    thumb: string;
}
export declare function buildMediaKeys(farmId: string, category: MediaCategory, mediaId: string): MediaKeys;
