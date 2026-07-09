-- Global search (RAKHAL-257). Enable pg_trgm for fuzzy/typo-tolerant matching
-- (similarity() + the `%` operator). At farm scale (a few hundred rows per farm,
-- already narrowed by the indexed farmId) a sequential trigram scan is trivially
-- fast, so no GIN indexes are added here — they can be introduced later if a
-- single farm's data grows large. Extension-only migration → no Prisma drift.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
