import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Button } from '../components/actions/Button.tsx';
import { ConfirmSheet } from '../components/feedback/ConfirmSheet.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import type { MessageKey } from '../i18n/messages.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { NotificationFilterTrigger } from './NotificationFilterTrigger.tsx';
import { CalendarClockIcon, CowIcon, EditIcon, PauseIcon, TrashIcon } from './notification-icons.tsx';
import type { AnimalScope, UpcomingItem } from './notification-types.ts';
import { findAssociatedAnimal } from './InboxTab.tsx';
import { useNotifications } from './useNotifications.ts';

interface UpcomingTabProps {
  scopedAnimal?: AnimalScope | null;
  selectedAnimals?: AnimalScope[];
  category?: string | null;
  group?: string | null;
  cattleList?: AnimalScope[];
  activeFilterCount?: number;
  onOpenFilters?: () => void;
  onResetFilters?: () => void;
  onEdit?: (scheduleId: string) => void;
  onNavigateToAnimal?: (animalId: string) => void;
  testID?: string;
}

type UpcomingRange = 'today' | 'week' | 'fortnight';

const RANGE_LABELS: Record<UpcomingRange, MessageKey> = {
  today: 'notif.upcoming.today',
  week: 'notif.upcoming.week',
  fortnight: 'notif.upcoming.fortnight',
};

export const UpcomingTab = memo(function UpcomingTab({
  scopedAnimal,
  selectedAnimals,
  category,
  group,
  cattleList,
  activeFilterCount = 0,
  onOpenFilters,
  onResetFilters,
  onEdit,
  onNavigateToAnimal,
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
        const itemCat = item.category?.toLowerCase() || '';
        const targetCat = category.toLowerCase();
        if (itemCat) {
          if (itemCat !== targetCat && !itemCat.includes(targetCat)) return false;
        } else {
          const textToSearch = `${item.title} ${item.body || ''}`.toLowerCase();
          if (!textToSearch.includes(targetCat)) return false;
        }
      }

      // 2. Animal filter (supports multi-selection)
      if (animals.length > 0) {
        const textToSearch = `${item.title} ${item.body || ''}`.toLowerCase();
        const animalMatched = animals.some((animal) => {
          const linkMatch = item.link
            ? item.link.includes(animal.id) || item.link.includes(animal.tagNumber)
            : false;
          const tag = animal.tagNumber.toLowerCase();
          const tagRegex = new RegExp(`(?:^|[^a-z0-9])#?${tag}(?:[^a-z0-9]|$)`, 'i');
          const tagMatch = tagRegex.test(textToSearch);
          const nameMatch =
            animal.name && animal.name.trim().length > 1
              ? textToSearch.includes(animal.name.trim().toLowerCase())
              : false;
          const animalIdsMatch = (item as unknown as { animal_ids?: string[] }).animal_ids?.includes(animal.id);

          return linkMatch || tagMatch || nameMatch || animalIdsMatch;
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

        if (!groupMatched && cattleList && cattleList.length > 0) {
          const matchingCattle = cattleList.filter((c) => c.group?.toLowerCase() === g);
          const textToSearch = `${item.title} ${item.body || ''} ${item.link || ''}`.toLowerCase();
          for (const c of matchingCattle) {
            if (
              (item.link && (item.link.includes(c.id) || item.link.includes(c.tagNumber))) ||
              textToSearch.includes(c.tagNumber.toLowerCase()) ||
              (c.name && c.name.length > 1 && textToSearch.includes(c.name.toLowerCase()))
            ) {
              groupMatched = true;
              break;
            }
          }
        }

        if (!groupMatched) {
          const textToSearch = `${item.title} ${item.body || ''}`.toLowerCase();
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

  // Group items by day
  const grouped = useMemo(() => {
    const map = new Map<string, UpcomingItem[]>();
    for (const it of filteredItems) {
      const day = it.fire_at_local ? it.fire_at_local.slice(0, 10) : it.fire_at.slice(0, 10);
      const list = map.get(day) || [];
      list.push(it);
      map.set(day, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredItems]);

  return (
    <View style={{ flex: 1 }} testID={testID}>
      {/* Unified Subheader: [ Today | 7d | 14d ] on Left, [ FilterIcon ] on Right */}
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
          {(['today', 'week', 'fortnight'] as const).map((r) => (
            <PressableSurface
              key={r}
              accessibilityRole="button"
              pressedStyle="overlay"
              onPress={() => setRange(r)}
              testID={`upcoming-range-${r}`}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              style={{
                paddingHorizontal: tokens.spacing.sm,
                height: 26,
                borderRadius: tokens.radius.md - 2,
                backgroundColor: range === r ? colors.card : 'transparent',
                borderWidth: range === r ? 1 : 0,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                role="caption"
                color={range === r ? 'primary' : 'mutedForeground'}
                style={{ fontWeight: '700', fontSize: 12 }}
              >
                {t(RANGE_LABELS[r])}
              </Text>
            </PressableSurface>
          ))}
        </View>

        {onOpenFilters ? (
          <NotificationFilterTrigger
            activeFilterCount={activeFilterCount}
            onPress={onOpenFilters}
            testID="notif-filter-trigger"
          />
        ) : null}
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
          <ActivityIndicator size="small" color={colors.primary} />
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
          testID="upcoming-filtered-empty-state"
        >
          <Text role="title" color="foreground" style={{ fontWeight: '700', fontSize: 16 }}>
            {t('notif.upcoming.emptyFiltered')}
          </Text>
          <Text role="body" color="mutedForeground" style={{ textAlign: 'center', fontSize: 14 }}>
            {t('notif.upcoming.emptyFilteredDescription')}
          </Text>
          {onResetFilters ? (
            <Button
              label={t('notif.filters.reset')}
              variant="secondary"
              size="md"
              onPress={onResetFilters}
              testID="upcoming-reset-filters-btn"
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

              {dayItems.map((item) => {
                const associatedAnimal = findAssociatedAnimal(
                  { link: item.link, title: item.title, message: item.body || '' },
                  cattleList,
                );
                return (
                  <PressableSurface
                    key={item.occurrence_id}
                    accessibilityRole="button"
                    pressedStyle="overlay"
                    disabled={!associatedAnimal}
                    onPress={associatedAnimal ? () => onNavigateToAnimal?.(associatedAnimal.id) : undefined}
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
                        {associatedAnimal ? (
                          <PressableSurface
                            accessibilityRole="button"
                            accessibilityLabel={`${associatedAnimal.tagNumber} ${associatedAnimal.name || ''}`}
                            pressedStyle="overlay"
                            onPress={() => onNavigateToAnimal?.(associatedAnimal.id)}
                            testID={`upcoming-item-animal-${item.occurrence_id}`}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: tokens.radius.full,
                              backgroundColor: colors.muted,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <CowIcon size={12} color={colors.primary} />
                            <Text role="caption" color="primary" style={{ fontWeight: '700', fontSize: 11 }}>
                              #{associatedAnimal.tagNumber}
                            </Text>
                            {associatedAnimal.name ? (
                              <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 11 }}>
                                · {associatedAnimal.name}
                              </Text>
                            ) : null}
                          </PressableSurface>
                        ) : null}

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
                </PressableSurface>
              );
            })}
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
