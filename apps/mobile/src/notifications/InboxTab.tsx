import { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Button } from '../components/actions/Button.tsx';
import { StatusBadge, type StatusTone } from '../components/display/StatusBadge.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import type { MessageKey } from '../i18n/messages.ts';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { CheckIcon } from './notification-icons.tsx';
import type { NotificationListItem, NotificationPriority } from './notification-types.ts';
import { useNotifications } from './useNotifications.ts';

interface InboxTabProps {
  onNavigate?: () => void;
  testID?: string;
}

const PRIORITY_TONE: Record<NotificationPriority, StatusTone> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

const PRIORITY_LABELS: Record<NotificationPriority, MessageKey> = {
  critical: 'notif.priority.critical',
  high: 'notif.priority.high',
  medium: 'notif.priority.medium',
  low: 'notif.priority.low',
};

export const InboxTab = memo(function InboxTab({
  onNavigate,
  testID = 'notification-inbox-tab',
}: InboxTabProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const format = useFormat();
  const { inboxResult, inboxLoading, loadInbox, markRead, markAllRead } = useNotifications();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    void loadInbox(filter, 1, pageSize);
  }, [loadInbox, filter, pageSize]);

  const items = inboxResult?.notifications ?? [];
  const unreadCount = inboxResult?.unread_count ?? 0;
  const total = inboxResult?.meta.total ?? 0;
  const hasMore = items.length < total;

  const handleItemPress = useCallback(
    (item: NotificationListItem) => {
      if (!item.read) {
        void markRead(item.id);
      }
      if (item.link && onNavigate) {
        onNavigate();
      }
    },
    [markRead, onNavigate],
  );

  return (
    <View style={{ flex: 1 }} testID={testID}>
      {/* Subheader: Filter Pills & Mark All Read */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: tokens.spacing.sm,
          gap: tokens.spacing.sm,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.muted,
            borderRadius: tokens.radius.md,
            padding: 2,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <PressableSurface
            accessibilityRole="button"
            pressedStyle="overlay"
            onPress={() => setFilter('all')}
            testID="inbox-filter-all"
            style={{
              paddingHorizontal: tokens.spacing.md,
              paddingVertical: 6,
              borderRadius: tokens.radius.md - 2,
              backgroundColor: filter === 'all' ? colors.card : 'transparent',
              borderWidth: filter === 'all' ? 1 : 0,
              borderColor: colors.border,
              minHeight: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              role="caption"
              color={filter === 'all' ? 'primary' : 'mutedForeground'}
              style={{ fontWeight: '700', fontSize: 13 }}
            >
              {t('notif.inbox.all')}
            </Text>
          </PressableSurface>

          <PressableSurface
            accessibilityRole="button"
            pressedStyle="overlay"
            onPress={() => setFilter('unread')}
            testID="inbox-filter-unread"
            style={{
              paddingHorizontal: tokens.spacing.md,
              paddingVertical: 6,
              borderRadius: tokens.radius.md - 2,
              backgroundColor: filter === 'unread' ? colors.card : 'transparent',
              borderWidth: filter === 'unread' ? 1 : 0,
              borderColor: colors.border,
              minHeight: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              role="caption"
              color={filter === 'unread' ? 'primary' : 'mutedForeground'}
              style={{ fontWeight: '700', fontSize: 13 }}
            >
              {t('notif.inbox.unread')}
              {unreadCount > 0 ? ` (${format.numberSafe(unreadCount)})` : ''}
            </Text>
          </PressableSurface>
        </View>

        {unreadCount > 0 ? (
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={t('notif.inbox.markAllRead')}
            pressedStyle="overlay"
            onPress={markAllRead}
            testID="inbox-mark-all-read"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: tokens.spacing.sm,
              paddingVertical: 6,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              minHeight: 32,
            }}
          >
            <CheckIcon size={14} color={colors.foreground} />
            <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 12 }}>
              {t('notif.inbox.markAllRead')}
            </Text>
          </PressableSurface>
        ) : null}
      </View>

      {/* Notifications List */}
      {inboxLoading && items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text role="body" color="mutedForeground" style={{ marginTop: 8 }}>
            {t('notif.inbox.loading')}
          </Text>
        </View>
      ) : items.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 48,
            gap: 8,
          }}
          testID="inbox-empty-state"
        >
          <Text role="title" color="foreground" style={{ fontWeight: '700', fontSize: 16 }}>
            {filter === 'unread' ? t('notif.inbox.emptyUnread') : t('notif.inbox.empty')}
          </Text>
          <Text role="body" color="mutedForeground" style={{ textAlign: 'center', fontSize: 14 }}>
            {t('notif.inbox.emptyDescription')}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: tokens.spacing.xs, paddingBottom: tokens.spacing.xl }}
        >
          {items.map((item) => {
            const tone = PRIORITY_TONE[item.priority] || 'neutral';
            const priorityLabel = t(PRIORITY_LABELS[item.priority]) || item.priority;
            return (
              <PressableSurface
                key={item.id}
                accessibilityRole="button"
                pressedStyle="overlay"
                onPress={() => handleItemPress(item)}
                testID={`inbox-item-${item.id}`}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: tokens.radius.md,
                  borderWidth: 1,
                  borderColor: item.read ? colors.border : colors.primaryEdge,
                  padding: tokens.spacing.sm,
                  gap: 4,
                  minHeight: 64,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <StatusBadge label={priorityLabel} tone={tone} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text role="caption" color="mutedForeground" style={{ fontSize: 11 }}>
                      {format.dateTimeSafe(new Date(item.created_at))}
                    </Text>
                    {!item.read ? (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.primary,
                        }}
                        testID={`unread-dot-${item.id}`}
                      />
                    ) : null}
                  </View>
                </View>

                <Text role="body" color="foreground" style={{ fontWeight: '700', fontSize: 14, marginTop: 2 }}>
                  {item.title}
                </Text>

                <Text role="caption" color="mutedForeground" style={{ fontSize: 13, lineHeight: 18 }}>
                  {item.message}
                </Text>
              </PressableSurface>
            );
          })}

          {hasMore ? (
            <View style={{ paddingTop: tokens.spacing.sm }}>
              <Button
                label={t('notif.inbox.loadMore')}
                variant="secondary"
                size="md"
                onPress={() => setPageSize((prev) => prev + 20)}
                testID="inbox-load-more"
              />
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
});
