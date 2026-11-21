import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import type { NotificationListResult } from './notification-types.ts';
import { NotificationSheet, type NotificationTabKey } from './NotificationSheet.tsx';

export interface NotificationContextValue {
  openNotifications: (initialTab?: NotificationTabKey) => void;
  closeNotifications: () => void;
  unreadCount: number;
  refreshUnreadCount: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export const NotificationProvider = memo(function NotificationProvider({ children }: { children: ReactNode }) {
  const { client, status } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<NotificationTabKey>('inbox');
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (status !== 'signedIn') return;
    try {
      const res = await client.get<NotificationListResult>('/notifications', {
        query: { status: 'unread', page: 1, per_page: 1 },
      });
      setUnreadCount(res.data?.unread_count || 0);
    } catch {
      // ignore
    }
  }, [client, status]);

  // Initial and periodic unread check
  useEffect(() => {
    void refreshUnreadCount();
    const interval = setInterval(() => {
      void refreshUnreadCount();
    }, 60000);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  const openNotifications = useCallback((tab: NotificationTabKey = 'inbox') => {
    setInitialTab(tab);
    setIsOpen(true);
  }, []);

  const closeNotifications = useCallback(() => {
    setIsOpen(false);
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  const value = useMemo(
    () => ({
      openNotifications,
      closeNotifications,
      unreadCount,
      refreshUnreadCount,
    }),
    [openNotifications, closeNotifications, unreadCount, refreshUnreadCount],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationSheet visible={isOpen} onClose={closeNotifications} initialTab={initialTab} />
    </NotificationContext.Provider>
  );
});

export function useNotificationContext(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    return {
      openNotifications: () => {},
      closeNotifications: () => {},
      unreadCount: 0,
      refreshUnreadCount: () => {},
    };
  }
  return ctx;
}
