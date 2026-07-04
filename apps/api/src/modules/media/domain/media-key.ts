import { MediaCategory } from '@prisma/client';

export interface MediaKeys {
  full: string;
  thumb: string;
}

/**
 * Object keys for an asset's variants (RAKHAL-009). Tenant-scoped and
 * non-guessable — `farmId` and `mediaId` are cuids (not sequential), so keys
 * can't be enumerated. Grouping by `mediaId` keeps an asset's variants together.
 */
export function buildMediaKeys(
  farmId: string,
  category: MediaCategory,
  mediaId: string,
): MediaKeys {
  const base = `farms/${farmId}/${category.toLowerCase()}/${mediaId}`;
  return { full: `${base}/full.jpg`, thumb: `${base}/thumb.jpg` };
}
