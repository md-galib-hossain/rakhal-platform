/**
 * Hook to load animal groups (WP9 & Redesign).
 * Reads from offline cache first, then syncs with API when available.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useSync } from '../offline/SyncProvider.tsx';
import type { AnimalGroupOption } from './CattleFilterSheet.tsx';

export function useAnimalGroups() {
  const sync = useSync();
  const { client } = useAuth();
  const [groups, setGroups] = useState<AnimalGroupOption[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Read from offline cache first (instant)
      if (sync.ready) {
        const cached = await sync.readCache('animalGroups');
        if (Array.isArray(cached) && cached.length > 0) {
          setGroups(
            cached.map((row) => ({
              id: String(row.id),
              name: String(row.name ?? ''),
              memberCount: typeof row.memberCount === 'number' ? row.memberCount : undefined,
            })),
          );
        }
      }

      // 2. Fetch latest from API when online
      const res = await client.get<{ items?: Array<{ id: string; name: string; memberCount?: number }> }>('/animal-groups', {
        query: { limit: 100 },
      });
      const items = res?.data?.items;
      if (Array.isArray(items)) {
        setGroups(
          items.map((g) => ({
            id: g.id,
            name: g.name,
            memberCount: g.memberCount,
          })),
        );
      }
    } catch {
      // Offline fallback: keep cached items
    } finally {
      setLoading(false);
    }
  }, [client, sync]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { groups, loading, reload };
}
