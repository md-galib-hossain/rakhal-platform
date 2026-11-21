import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { ConfirmSheet } from '../components/feedback/ConfirmSheet.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import type { MessageKey } from '../i18n/messages.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { CalendarClockIcon, EditIcon, PauseIcon, TrashIcon } from './notification-icons.tsx';
import type { UpcomingItem } from './notification-types.ts';
import { useNotifications } from './useNotifications.ts';

interface UpcomingTabProps {
  onEdit?: (scheduleId: string) => void;
  testID?: string;
}

type UpcomingRange = 'today' | 'week' | 'fortnight';

const RANGE_LABELS: Record<UpcomingRange, MessageKey> = {
  today: 'notif.upcoming.today',
  week: 'notif.upcoming.week',
  fortnight: 'notif.upcoming.fortnight',
};

export const UpcomingTab = memo(function UpcomingTab({
  onEdit,
  testID = 'notification-upcoming-tab',
}: UpcomingTabProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const { loadUpcoming, pauseSchedule, resumeSchedule, cancelSchedule } = useNotifications();

  const [range, setRange] = useState<UpcomingRange>('fortnight');
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingItem, setCancellingItem] = useState<UpcomingItem | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const fromStr = now.toISOString().slice(0, 10);
    const daysToAdd = range === 'today' ? 0 : range === 'week' ? 6 : 13;
    const toDate = new Date(now.getTime() + daysToAdd * 86400000);
    const toStr = toDate.toISOString().slice(0, 10);

    const result = await loadUpcoming(fromStr, toStr);
    setItems(result);
    setLoading(false);
  }, [loadUpcoming, range]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const handlePauseResume = useCallback(
    async (item: UpcomingItem) => {
      try {
        await pauseSchedule(item.schedule_id);
        void fetchItems();
      } catch {
        // try resume if paused
        try {
          await resumeSchedule(item.schedule_id);
          void fetchItems();
        } catch {
          // Ignore
        }
      }
    },
    [pauseSchedule, resumeSchedule, fetchItems],
  );

  const handleConfirmCancel = useCallback(async () => {
    if (!cancellingItem) return;
    try {
      await cancelSchedule(cancellingItem.schedule_id);
      setCancellingItem(null);
      void fetchItems();
    } catch {
      // Ignore
    }
  }, [cancellingItem, cancelSchedule, fetchItems]);

  // Group items by day
  const grouped = useMemo(() => {
    const map = new Map<string, UpcomingItem[]>();
    for (const it of items) {
      const day = it.fire_at_local ? it.fire_at_local.slice(0, 10) : it.fire_at.slice(0, 10);
      const list = map.get(day) || [];
      list.push(it);
      map.set(day, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  return (
    <View style={{ flex: 1 }} testID={testID}>
      {/* Range Filter Pills */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.muted,
          borderRadius: tokens.radius.md,
          padding: 2,
          marginVertical: tokens.spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {(['today', 'week', 'fortnight'] as const).map((r) => (
          <PressableSurface
            key={r}
            accessibilityRole="button"
            pressedStyle="overlay"
            onPress={() => setRange(r)}
            testID={`upcoming-range-${r}`}
            style={{
              flex: 1,
              paddingVertical: 6,
              borderRadius: tokens.radius.md - 2,
              backgroundColor: range === r ? colors.card : 'transparent',
              borderWidth: range === r ? 1 : 0,
              borderColor: colors.border,
              minHeight: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              role="caption"
              color={range === r ? 'primary' : 'mutedForeground'}
              style={{ fontWeight: '700', fontSize: 13 }}
            >
              {t(RANGE_LABELS[r])}
            </Text>
          </PressableSurface>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
          <ActivityIndicator size="small" color={colors.primary} />
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
          testID="upcoming-empty-state"
        >
          <CalendarClockIcon size={44} color={colors.mutedForeground} />
          <Text role="title" color="foreground" style={{ fontWeight: '700', fontSize: 16 }}>
            {t('notif.upcoming.empty')}
          </Text>
          <Text role="body" color="mutedForeground" style={{ textAlign: 'center', fontSize: 14 }}>
            {t('notif.upcoming.emptyDescription')}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: tokens.spacing.md, paddingBottom: tokens.spacing.xl }}
        >
          {grouped.map(([day, dayItems]) => (
            <View key={day} style={{ gap: tokens.spacing.xs }}>
              <Text role="caption" color="mutedForeground" style={{ fontWeight: '700', fontSize: 12 }}>
                {day}
              </Text>

              {dayItems.map((item) => (
                <View
                  key={item.occurrence_id}
                  testID={`upcoming-item-${item.occurrence_id}`}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: tokens.radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: tokens.spacing.sm,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text role="body" color="foreground" style={{ fontWeight: '700', fontSize: 14, flex: 1 }}>
                      {item.title}
                    </Text>
                    <Text role="caption" color="primary" style={{ fontWeight: '700', fontSize: 12 }}>
                      {item.fire_at_local ? item.fire_at_local.slice(11, 16) : ''}
                    </Text>
                  </View>

                  {item.body ? (
                    <Text role="caption" color="mutedForeground" style={{ fontSize: 13, lineHeight: 18 }}>
                      {item.body}
                    </Text>
                  ) : null}

                  {/* Badges & Actions */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 2,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {item.repeat && item.repeat !== 'NEVER' ? (
                        <View
                          style={{
                            backgroundColor: colors.muted,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: tokens.radius.sm,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Text role="caption" color="mutedForeground" style={{ fontSize: 10, fontWeight: '600' }}>
                            {item.repeat === 'WEEKLY'
                              ? t('notif.upcoming.repeatsWeekly')
                              : item.repeat === 'MONTHLY'
                                ? t('notif.upcoming.repeatsMonthly')
                                : t('notif.upcoming.repeatsDays', { n: 'N' })}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {item.can_edit ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {onEdit ? (
                          <PressableSurface
                            accessibilityRole="button"
                            accessibilityLabel={t('notif.upcoming.edit')}
                            pressedStyle="overlay"
                            onPress={() => onEdit(item.schedule_id)}
                            style={{
                              padding: 6,
                              borderRadius: tokens.radius.sm,
                              borderWidth: 1,
                              borderColor: colors.border,
                              minHeight: 28,
                              minWidth: 28,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <EditIcon size={14} color={colors.foreground} />
                          </PressableSurface>
                        ) : null}

                        <PressableSurface
                          accessibilityRole="button"
                          accessibilityLabel={t('notif.upcoming.pause')}
                          pressedStyle="overlay"
                          onPress={() => handlePauseResume(item)}
                          style={{
                            padding: 6,
                            borderRadius: tokens.radius.sm,
                            borderWidth: 1,
                            borderColor: colors.border,
                            minHeight: 28,
                            minWidth: 28,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <PauseIcon size={14} color={colors.foreground} />
                        </PressableSurface>

                        <PressableSurface
                          accessibilityRole="button"
                          accessibilityLabel={t('notif.upcoming.cancel')}
                          pressedStyle="overlay"
                          onPress={() => setCancellingItem(item)}
                          style={{
                            padding: 6,
                            borderRadius: tokens.radius.sm,
                            borderWidth: 1,
                            borderColor: colors.border,
                            minHeight: 28,
                            minWidth: 28,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <TrashIcon size={14} color={colors.destructive} />
                        </PressableSurface>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Cancel Confirm Sheet */}
      <ConfirmSheet
        visible={cancellingItem !== null}
        onCancel={() => setCancellingItem(null)}
        title={t('notif.upcoming.cancelConfirmTitle')}
        message={t('notif.upcoming.cancelConfirmBody')}
        confirmLabel={t('notif.upcoming.cancel')}
        cancelLabel={t('common.cancel')}
        tone="destructive"
        onConfirm={handleConfirmCancel}
      />
    </View>
  );
});
