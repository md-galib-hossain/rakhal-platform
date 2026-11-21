import { useCallback, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import type {
  CreateScheduleInput,
  FarmMemberOption,
  NotificationListResult,
  NotificationPreferencesResult,
  NotificationSchedule,
  SchedulePreview,
  UpcomingItem,
  UpdateScheduleInput,
} from './notification-types.ts';

export function useNotifications() {
  const { client, status: authStatus } = useAuth();

  const [inboxResult, setInboxResult] = useState<NotificationListResult | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);

  // 1. Fetch notifications
  const loadInbox = useCallback(
    async (status: 'all' | 'unread' = 'all', page = 1, perPage = 20) => {
      if (authStatus !== 'signedIn') return;
      setInboxLoading(true);
      setInboxError(null);
      try {
        const res = await client.get<NotificationListResult>('/notifications', {
          query: { status, page, per_page: perPage },
        });
        setInboxResult(res.data);
      } catch (err) {
        setInboxError((err as Error).message || 'Failed to load notifications');
      } finally {
        setInboxLoading(false);
      }
    },
    [client, authStatus],
  );

  // 2. Mark single notification read
  const markRead = useCallback(
    async (id: string) => {
      try {
        await client.post<{ id: string; read: boolean }>(`/notifications/${encodeURIComponent(id)}/read`, {});
        setInboxResult((prev) => {
          if (!prev) return prev;
          const updated = prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
          const unreadDiff = prev.notifications.some((n) => n.id === id && !n.read) ? 1 : 0;
          return {
            ...prev,
            unread_count: Math.max(0, prev.unread_count - unreadDiff),
            notifications: updated,
          };
        });
      } catch {
        // Optimistic / ignore silent failure
      }
    },
    [client],
  );

  // 3. Mark all read
  const markAllRead = useCallback(async () => {
    try {
      await client.post<{ updated: number }>('/notifications/read-all', {});
      setInboxResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          unread_count: 0,
          notifications: prev.notifications.map((n) => ({ ...n, read: true })),
        };
      });
    } catch {
      // Ignore
    }
  }, [client]);

  // 4. Fetch upcoming items
  const loadUpcoming = useCallback(
    async (from: string, to: string): Promise<UpcomingItem[]> => {
      try {
        const res = await client.get<{ items?: UpcomingItem[]; data?: UpcomingItem[] }>('/notifications/upcoming', {
          query: { from, to, limit: 100 },
        });
        const d = res.data;
        if (d && Array.isArray(d.items)) return d.items;
        if (d && Array.isArray(d.data)) return d.data;
        if (Array.isArray(d)) return d as unknown as UpcomingItem[];
        return [];
      } catch {
        return [];
      }
    },
    [client],
  );

  // 5. Pause schedule
  const pauseSchedule = useCallback(
    async (id: string) => {
      await client.post(`/notifications/schedules/${encodeURIComponent(id)}/pause`, {});
    },
    [client],
  );

  // 6. Resume schedule
  const resumeSchedule = useCallback(
    async (id: string) => {
      await client.post(`/notifications/schedules/${encodeURIComponent(id)}/resume`, {});
    },
    [client],
  );

  // 7. Cancel schedule
  const cancelSchedule = useCallback(
    async (id: string) => {
      await client.delete(`/notifications/schedules/${encodeURIComponent(id)}`);
    },
    [client],
  );

  // 8. Create schedule
  const createSchedule = useCallback(
    async (input: CreateScheduleInput): Promise<NotificationSchedule> => {
      const res = await client.post<NotificationSchedule>('/notifications/schedules', input);
      return res.data;
    },
    [client],
  );

  // 9. Update schedule
  const updateSchedule = useCallback(
    async (id: string, input: UpdateScheduleInput): Promise<NotificationSchedule> => {
      const res = await client.patch<NotificationSchedule>(`/notifications/schedules/${encodeURIComponent(id)}`, input);
      return res.data;
    },
    [client],
  );

  // 10. Preview schedule
  const previewSchedule = useCallback(
    async (input: CreateScheduleInput): Promise<SchedulePreview | null> => {
      try {
        const res = await client.post<SchedulePreview>('/notifications/schedules/preview', input);
        return res.data;
      } catch {
        return null;
      }
    },
    [client],
  );

  // 11. Preferences
  const loadPreferences = useCallback(async (): Promise<NotificationPreferencesResult | null> => {
    try {
      const res = await client.get<NotificationPreferencesResult>('/notifications/preferences');
      return res.data;
    } catch {
      return null;
    }
  }, [client]);

  const updatePreferences = useCallback(
    async (body: unknown): Promise<NotificationPreferencesResult | null> => {
      try {
        const res = await client.patch<NotificationPreferencesResult>('/notifications/preferences', body);
        return res.data;
      } catch {
        return null;
      }
    },
    [client],
  );

  // 12. Farm members / assignees
  const loadFarmMembers = useCallback(async (): Promise<FarmMemberOption[]> => {
    try {
      const res = await client.get<Array<{ id: string; name: string; email?: string; role?: string }>>(
        '/tasks/assignees',
      );
      if (Array.isArray(res.data)) {
        return res.data.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role }));
      }
      return [];
    } catch {
      return [];
    }
  }, [client]);

  return {
    inboxResult,
    inboxLoading,
    inboxError,
    loadInbox,
    markRead,
    markAllRead,
    loadUpcoming,
    pauseSchedule,
    resumeSchedule,
    cancelSchedule,
    createSchedule,
    updateSchedule,
    previewSchedule,
    loadPreferences,
    updatePreferences,
    loadFarmMembers,
  };
}
