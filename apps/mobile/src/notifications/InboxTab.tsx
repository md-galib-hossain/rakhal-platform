import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Button } from '../components/actions/Button.tsx';
import { StatusBadge, type StatusTone } from '../components/display/StatusBadge.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import type { MessageKey } from '../i18n/messages.ts';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { NotificationFilterTrigger } from './NotificationFilterTrigger.tsx';
import { CheckIcon } from './notification-icons.tsx';
import type { AnimalScope, NotificationListItem, NotificationPriority } from './notification-types.ts';
import { useNotifications } from './useNotifications.ts';

const EVENT_TO_CATEGORY: Record<string, string> = {
  animal_sickness_reported: 'health_safety',
  medicine_expired: 'health_safety',
  withholding_active: 'health_safety',
  withholding_ended: 'health_safety',
  morbidity_outbreak: 'health_safety',
  scheduled_vaccination: 'health_safety',
  scheduled_deworming: 'health_safety',
  scheduled_treatment: 'health_safety',
  vwp_complete_ready_ai: 'reproduction',
  scheduled_calving: 'reproduction',
  scheduled_heat: 'reproduction',
  scheduled_pregnancy_check: 'reproduction',
  scheduled_dry_off: 'reproduction',
  low_medicine_stock: 'operational',
  low_feed_stock: 'operational',
  daily_milk_log_reminder: 'operational',
  task_overdue: 'operational',
  safety_critical_task_overdue: 'operational',
  todays_tasks_ready: 'operational',
  bulk_event_recorded: 'operational',
  payment_overdue: 'financial',
  survival_runway_warning: 'financial',
  supplier_payment_due_soon: 'financial',
  buyer_payment_received: 'financial',
  invoice_overdue: 'financial',
  low_stock_threshold: 'inventory',
  inventory_expired: 'inventory',
  stock_discrepancy: 'inventory',
};

interface InboxTabProps {
  scopedAnimal?: AnimalScope | null;
  selectedAnimals?: AnimalScope[];
  category?: string | null;
  group?: string | null;
  cattleList?: AnimalScope[];
  activeFilterCount?: number;
  onOpenFilters?: () => void;
  onResetFilters?: () => void;
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
  scopedAnimal,
  selectedAnimals,
  category,
  group,
  cattleList,
  activeFilterCount = 0,
  onOpenFilters,
  onResetFilters,
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

  const animals = useMemo(() => {
    if (selectedAnimals && selectedAnimals.length > 0) return selectedAnimals;
    if (scopedAnimal) return [scopedAnimal];
    return [];
  }, [selectedAnimals, scopedAnimal]);

  const hasExtraFilters = Boolean(
    (category && category !== 'all') || animals.length > 0 || (group && group !== 'all'),
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Category filter
      if (category && category !== 'all') {
        const itemCat = EVENT_TO_CATEGORY[item.type] || (item as unknown as { category?: string }).category;
        if (itemCat) {
          if (itemCat !== category) return false;
        } else {
          const normType = item.type.toLowerCase();
          const normCat = category.toLowerCase();
          if (normCat === 'health_safety') {
            if (
              !normType.includes('health') &&
              !normType.includes('sickness') &&
              !normType.includes('medicine') &&
              !normType.includes('withholding') &&
              !normType.includes('morbidity')
            ) {
              return false;
            }
          } else if (normCat === 'reproduction') {
            if (
              !normType.includes('repro') &&
              !normType.includes('calv') &&
              !normType.includes('heat') &&
              !normType.includes('preg') &&
              !normType.includes('dry_off') &&
              !normType.includes('ai')
            ) {
              return false;
            }
          } else if (normCat === 'operational') {
            if (
              !normType.includes('operat') &&
              !normType.includes('task') &&
              !normType.includes('log') &&
              !normType.includes('feed')
            ) {
              return false;
            }
          } else if (normCat === 'financial') {
            if (
              !normType.includes('finan') &&
              !normType.includes('pay') &&
              !normType.includes('invoice') &&
              !normType.includes('runway')
            ) {
              return false;
            }
          } else if (normCat === 'inventory') {
            if (!normType.includes('invent') && !normType.includes('stock')) {
              return false;
            }
          } else if (!normType.includes(normCat)) {
            return false;
          }
        }
      }

      // 2. Animal filter (supports multi-selection)
      if (animals.length > 0) {
        const textToSearch = `${item.title} ${item.message}`.toLowerCase();
        const dataAny = item.data as Record<string, unknown> | undefined;

        const animalMatched = animals.some((animal) => {
          const linkMatch = item.link
            ? item.link.includes(animal.id) || item.link.includes(animal.tagNumber)
            : false;
          const dataMatch =
            dataAny?.animalId === animal.id ||
            dataAny?.cattleId === animal.id ||
            (Array.isArray(dataAny?.animalIds) && (dataAny.animalIds as string[]).includes(animal.id)) ||
            dataAny?.tagNumber === animal.tagNumber;
          const tag = animal.tagNumber.toLowerCase();
          const tagRegex = new RegExp(`(?:^|[^a-z0-9])#?${tag}(?:[^a-z0-9]|$)`, 'i');
          const tagMatch = tagRegex.test(textToSearch);
          const nameMatch =
            animal.name && animal.name.trim().length > 1
              ? textToSearch.includes(animal.name.trim().toLowerCase())
              : false;

          return linkMatch || dataMatch || tagMatch || nameMatch;
        });

        if (!animalMatched) {
          return false;
        }
      }

      // 3. Cattle group filter
      if (group && group !== 'all') {
        const g = group.toLowerCase();
        let groupMatched = false;

        if (animals.length > 0 && animals.some((a) => a.group?.toLowerCase() === g)) {
          groupMatched = true;
        }

        const dataAny = item.data as Record<string, unknown> | undefined;
        if (dataAny?.group?.toString().toLowerCase() === g) {
          groupMatched = true;
        }

        if (!groupMatched && cattleList && cattleList.length > 0) {
          const matchingCattle = cattleList.filter((c) => c.group?.toLowerCase() === g);
          const textToSearch = `${item.title} ${item.message} ${item.link || ''}`.toLowerCase();
          for (const c of matchingCattle) {
            if (
              (item.link && (item.link.includes(c.id) || item.link.includes(c.tagNumber))) ||
              dataAny?.animalId === c.id ||
              dataAny?.cattleId === c.id ||
              (Array.isArray(dataAny?.animalIds) && (dataAny.animalIds as string[]).includes(c.id)) ||
              textToSearch.includes(c.tagNumber.toLowerCase()) ||
              (c.name && c.name.length > 1 && textToSearch.includes(c.name.toLowerCase()))
            ) {
              groupMatched = true;
              break;
            }
          }
        }

        if (!groupMatched) {
          const textToSearch = `${item.title} ${item.message}`.toLowerCase();
          const groupRegex = new RegExp(`(?:^|[^a-z0-9])${g}(?:[^a-z0-9]|$)`, 'i');
          if (groupRegex.test(textToSearch)) {
            groupMatched = true;
          }
        }

        if (!groupMatched) return false;
      }

      return true;
    });
  }, [items, category, animals, group, cattleList]);

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
      {/* Unified Subheader: [ All | Unread ] on Left, [ Mark All Read ] + [ FilterIcon ] on Right */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: tokens.spacing.xs,
          marginBottom: tokens.spacing.xs,
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
            height: 32,
            alignItems: 'center',
          }}
        >
          <PressableSurface
            accessibilityRole="button"
            pressedStyle="overlay"
            onPress={() => setFilter('all')}
            testID="inbox-filter-all"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={{
              paddingHorizontal: tokens.spacing.md,
              height: 26,
              borderRadius: tokens.radius.md - 2,
              backgroundColor: filter === 'all' ? colors.card : 'transparent',
              borderWidth: filter === 'all' ? 1 : 0,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              role="caption"
              color={filter === 'all' ? 'primary' : 'mutedForeground'}
              style={{ fontWeight: '700', fontSize: 12 }}
            >
              {t('notif.inbox.all')}
            </Text>
          </PressableSurface>

          <PressableSurface
            accessibilityRole="button"
            pressedStyle="overlay"
            onPress={() => setFilter('unread')}
            testID="inbox-filter-unread"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={{
              paddingHorizontal: tokens.spacing.md,
              height: 26,
              borderRadius: tokens.radius.md - 2,
              backgroundColor: filter === 'unread' ? colors.card : 'transparent',
              borderWidth: filter === 'unread' ? 1 : 0,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              role="caption"
              color={filter === 'unread' ? 'primary' : 'mutedForeground'}
              style={{ fontWeight: '700', fontSize: 12 }}
            >
              {t('notif.inbox.unread')}
              {unreadCount > 0 ? ` (${format.numberSafe(unreadCount)})` : ''}
            </Text>
          </PressableSurface>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
          {unreadCount > 0 ? (
            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel={t('notif.inbox.markAllRead')}
              pressedStyle="overlay"
              onPress={markAllRead}
              testID="inbox-mark-all-read"
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: tokens.spacing.sm,
                height: 32,
                borderRadius: tokens.radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <CheckIcon size={14} color={colors.foreground} />
              <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 12 }}>
                {t('notif.inbox.markAllRead')}
              </Text>
            </PressableSurface>
          ) : null}

          {onOpenFilters ? (
            <NotificationFilterTrigger
              activeFilterCount={activeFilterCount}
              onPress={onOpenFilters}
              testID="notif-filter-trigger"
            />
          ) : null}
        </View>
      </View>

      {/* Notifications List */}
      {inboxLoading && items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text role="body" color="mutedForeground" style={{ marginTop: 8 }}>
            {t('notif.inbox.loading')}
          </Text>
        </View>
      ) : hasExtraFilters && items.length > 0 && filteredItems.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 48,
            paddingHorizontal: 24,
            gap: 12,
          }}
          testID="inbox-filtered-empty-state"
        >
          <Text role="title" color="foreground" style={{ fontWeight: '700', fontSize: 16 }}>
            {t('notif.inbox.emptyFiltered')}
          </Text>
          <Text role="body" color="mutedForeground" style={{ textAlign: 'center', fontSize: 14 }}>
            {t('notif.inbox.emptyFilteredDescription')}
          </Text>
          {onResetFilters ? (
            <Button
              label={t('notif.filters.reset')}
              variant="secondary"
              size="md"
              onPress={onResetFilters}
              testID="inbox-reset-filters-btn"
            />
          ) : null}
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
          {filteredItems.map((item) => {
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
