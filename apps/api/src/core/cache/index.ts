/**
 * Global Redis-backed cache.
 *
 *   // CacheModule is @Global — no import needed, just inject:
 *   constructor(private readonly cache: CacheService) {}
 */
export * from './cache.service';
export * from './cache.module';
