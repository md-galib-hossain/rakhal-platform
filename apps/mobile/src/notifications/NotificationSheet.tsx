import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
import { IconButton } from '../components/actions/IconButton.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { Text } from '../components/primitives/Text.tsx';
import type { MessageKey } from '../i18n/messages.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { InboxTab } from './InboxTab.tsx';
import { NewTab } from './NewTab.tsx';
import {
  ArrowLeftIcon,
  CheckIcon,
  CowIcon,
  SettingsSlidersIcon,
  XIcon,
} from './notification-icons.tsx';
import { NotificationPreferencesView } from './NotificationPreferencesView.tsx';
import type { AnimalScope } from './notification-types.ts';
import { UpcomingTab } from './UpcomingTab.tsx';

export type NotificationTabKey = 'inbox' | 'upcoming' | 'new';

const TAB_LABELS: Record<NotificationTabKey, MessageKey> = {
  inbox: 'notif.tabs.inbox',
  upcoming: 'notif.tabs.upcoming',
  new: 'notif.tabs.new',
};

const CATEGORY_OPTIONS: Array<{ key: string; labelKey: MessageKey }> = [
  { key: 'all', labelKey: 'notif.filters.allCategories' },
  { key: 'health_safety', labelKey: 'notif.category.healthSafety' },
  { key: 'reproduction', labelKey: 'notif.category.reproduction' },
  { key: 'operational', labelKey: 'notif.category.operational' },
  { key: 'financial', labelKey: 'notif.category.financial' },
  { key: 'inventory', labelKey: 'notif.category.inventory' },
];

const GROUP_OPTIONS: Array<{ key: string; labelKey: MessageKey }> = [
  { key: 'all', labelKey: 'notif.filters.allGroups' },
  { key: 'milking', labelKey: 'notif.group.milking' },
  { key: 'dry', labelKey: 'notif.group.dry' },
  { key: 'heifer', labelKey: 'notif.group.heifer' },
  { key: 'bull', labelKey: 'notif.group.bull' },
  { key: 'calf', labelKey: 'notif.group.calf' },
  { key: 'sick', labelKey: 'notif.group.sick' },
];

export interface NotificationSheetProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: NotificationTabKey;
  initialAnimal?: AnimalScope | null;
  testID?: string;
}

export const NotificationSheet = memo(function NotificationSheet({
  visible,
  onClose,
  initialTab = 'inbox',
  initialAnimal = null,
  testID = 'notification-sheet',
}: NotificationSheetProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const { client } = useAuth();

  const [activeTab, setActiveTab] = useState<NotificationTabKey>(initialTab);
  const [view, setView] = useState<'tabs' | 'preferences'>('tabs');
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  // Scoped animals & filter states
  const [selectedAnimals, setSelectedAnimals] = useState<AnimalScope[]>(
    initialAnimal ? [initialAnimal] : [],
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // Filter sheets
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [animalModalOpen, setAnimalModalOpen] = useState(false);
  const [animalSearch, setAnimalSearch] = useState('');
  const [availableAnimals, setAvailableAnimals] = useState<AnimalScope[]>([]);

  // Synchronize when initial props change
  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
      if (initialAnimal !== undefined) {
        setSelectedAnimals(initialAnimal ? [initialAnimal] : []);
      }
    }
  }, [visible, initialTab, initialAnimal]);

  // Load available animals for picker and group matching
  useEffect(() => {
    void client
      .get<{
        items?: Array<{ id: string; tagNumber: string; name?: string; status?: string; category?: string }>;
      }>('/cattle', {
        query: { limit: 100 },
      })
      .then((res) => {
        const d = res.data;
        const list = (d && Array.isArray(d.items) ? d.items : Array.isArray(d) ? d : []) as Array<{
          id: string;
          tagNumber: string;
          name?: string;
          status?: string;
          category?: string;
        }>;
        setAvailableAnimals(
          list.map((c) => ({
            id: c.id,
            tagNumber: c.tagNumber,
            name: c.name,
            group: c.status ?? c.category,
          })),
        );
      })
      .catch(() => {});
  }, [client]);

  const handleEditSchedule = useCallback((scheduleId: string) => {
    setEditingScheduleId(scheduleId);
    setActiveTab('new');
    setView('tabs');
  }, []);

  const handleDoneOrCancelNew = useCallback(() => {
    setEditingScheduleId(null);
    setActiveTab('upcoming');
  }, []);

  const handleClose = useCallback(() => {
    setView('tabs');
    setEditingScheduleId(null);
    setFilterModalOpen(false);
    setAnimalModalOpen(false);
    onClose();
  }, [onClose]);

  const handleResetFilters = useCallback(() => {
    setSelectedAnimals([]);
    setSelectedCategory(null);
    setSelectedGroup(null);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory && selectedCategory !== 'all') count += 1;
    if (selectedGroup && selectedGroup !== 'all') count += 1;
    count += selectedAnimals.length;
    return count;
  }, [selectedCategory, selectedGroup, selectedAnimals]);

  const filteredAnimals = useMemo(() => {
    const q = animalSearch.trim().toLowerCase();
    if (!q) return availableAnimals;
    return availableAnimals.filter(
      (a) => a.tagNumber.toLowerCase().includes(q) || (a.name && a.name.toLowerCase().includes(q)),
    );
  }, [availableAnimals, animalSearch]);

  return (
    <SheetModal
      visible={visible}
      onRequestClose={handleClose}
      testID={testID}
      scrollable={false}
      heightFraction={0.78}
    >
      {/* 1. Header (Always fixed at top) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: tokens.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          marginBottom: tokens.spacing.xs,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs, flex: 1 }}>
          {view === 'preferences' ? (
            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel={t('notif.back')}
              pressedStyle="overlay"
              onPress={() => setView('tabs')}
              testID="notif-back-btn"
              style={{
                width: 36,
                height: 36,
                borderRadius: tokens.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowLeftIcon size={18} color={colors.foreground} />
            </PressableSurface>
          ) : null}

          <SheetTitle>
            {view === 'preferences' ? t('notif.preferences') : t('notif.title')}
          </SheetTitle>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
          {view === 'tabs' ? (
            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel={t('notif.preferences')}
              pressedStyle="overlay"
              onPress={() => setView('preferences')}
              testID="notif-settings-btn"
              style={{
                width: 40,
                height: 40,
                borderRadius: tokens.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <SettingsSlidersIcon size={18} color={colors.foreground} />
            </PressableSurface>
          ) : null}

          <IconButton
            icon="close"
            accessibilityLabel={t('common.close')}
            variant="ghost"
            size="md"
            onPress={handleClose}
            testID="notif-sheet-close"
          />
        </View>
      </View>

      {/* 2. Content */}
      {view === 'preferences' ? (
        <View style={{ flex: 1 }}>
          <NotificationPreferencesView />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Segmented Tabs Control (Fixed below header) */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.muted,
              borderRadius: tokens.radius.md,
              padding: 2,
              marginVertical: tokens.spacing.xs,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {(['inbox', 'upcoming', 'new'] as const).map((tabKey) => {
              const active = activeTab === tabKey;
              return (
                <PressableSurface
                  key={tabKey}
                  accessibilityRole="tab"
                  accessibilityLabel={t(TAB_LABELS[tabKey])}
                  pressedStyle="overlay"
                  onPress={() => {
                    if (tabKey !== 'new') setEditingScheduleId(null);
                    setActiveTab(tabKey);
                  }}
                  testID={`notif-tab-${tabKey}`}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: tokens.radius.md - 2,
                    backgroundColor: active ? colors.card : 'transparent',
                    borderWidth: active ? 1 : 0,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 36,
                  }}
                >
                  <Text
                    role="caption"
                    color={active ? 'primary' : 'mutedForeground'}
                    style={{ fontWeight: '700', fontSize: 13 }}
                  >
                    {t(TAB_LABELS[tabKey])}
                  </Text>
                </PressableSurface>
              );
            })}
          </View>

          {/* Active Tab Body (Scrollable inside flex: 1) */}
          <View style={{ flex: 1, marginTop: tokens.spacing.xs }}>
            {activeTab === 'inbox' ? (
              <InboxTab
                selectedAnimals={selectedAnimals}
                category={selectedCategory}
                group={selectedGroup}
                cattleList={availableAnimals}
                activeFilterCount={activeFilterCount}
                onOpenFilters={() => setFilterModalOpen(true)}
                onResetFilters={handleResetFilters}
                onNavigate={handleClose}
              />
            ) : activeTab === 'upcoming' ? (
              <UpcomingTab
                selectedAnimals={selectedAnimals}
                category={selectedCategory}
                group={selectedGroup}
                cattleList={availableAnimals}
                activeFilterCount={activeFilterCount}
                onOpenFilters={() => setFilterModalOpen(true)}
                onResetFilters={handleResetFilters}
                onEdit={handleEditSchedule}
              />
            ) : (
              <NewTab
                editingScheduleId={editingScheduleId}
                initialAnimal={selectedAnimals.length > 0 ? selectedAnimals[0] : null}
                onDone={handleDoneOrCancelNew}
                onCancel={handleDoneOrCancelNew}
              />
            )}
          </View>
        </View>
      )}

      {/* 3. Comprehensive Filter Sheet Modal */}
      <SheetModal
        visible={filterModalOpen}
        onRequestClose={() => setFilterModalOpen(false)}
        testID="notif-filter-sheet"
        scrollable={false}
        heightFraction={0.58}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: tokens.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            marginBottom: tokens.spacing.sm,
          }}
        >
          <SheetTitle>{t('notif.filters.title')}</SheetTitle>
          <IconButton
            icon="close"
            accessibilityLabel={t('common.close')}
            variant="ghost"
            size="md"
            onPress={() => setFilterModalOpen(false)}
            testID="notif-filter-sheet-close"
          />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: tokens.spacing.md, paddingBottom: tokens.spacing.md }}
        >
          {/* Section 1: Event Category */}
          <View style={{ gap: tokens.spacing.xs }}>
            <Text role="caption" color="mutedForeground" style={{ fontWeight: '700', fontSize: 12 }}>
              {t('notif.filters.category')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORY_OPTIONS.map((cat) => {
                const isSelected =
                  (cat.key === 'all' && (!selectedCategory || selectedCategory === 'all')) ||
                  selectedCategory === cat.key;
                return (
                  <PressableSurface
                    key={cat.key}
                    accessibilityRole="button"
                    pressedStyle="overlay"
                    onPress={() => setSelectedCategory(cat.key === 'all' ? null : cat.key)}
                    testID={`filter-category-${cat.key}`}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: tokens.radius.md,
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      minHeight: 36,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      role="caption"
                      color={isSelected ? 'primaryForeground' : 'foreground'}
                      style={{ fontWeight: '600', fontSize: 13 }}
                    >
                      {t(cat.labelKey)}
                    </Text>
                  </PressableSurface>
                );
              })}
            </View>
          </View>

          {/* Section 2: Cattle Group */}
          <View style={{ gap: tokens.spacing.xs }}>
            <Text role="caption" color="mutedForeground" style={{ fontWeight: '700', fontSize: 12 }}>
              {t('notif.filters.group')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {GROUP_OPTIONS.map((grp) => {
                const isSelected =
                  (grp.key === 'all' && (!selectedGroup || selectedGroup === 'all')) ||
                  selectedGroup === grp.key;
                return (
                  <PressableSurface
                    key={grp.key}
                    accessibilityRole="button"
                    pressedStyle="overlay"
                    onPress={() => setSelectedGroup(grp.key === 'all' ? null : grp.key)}
                    testID={`filter-group-${grp.key}`}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: tokens.radius.md,
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      minHeight: 36,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      role="caption"
                      color={isSelected ? 'primaryForeground' : 'foreground'}
                      style={{ fontWeight: '600', fontSize: 13 }}
                    >
                      {t(grp.labelKey)}
                    </Text>
                  </PressableSurface>
                );
              })}
            </View>
          </View>

          {/* Section 3: Specific Animals */}
          <View style={{ gap: tokens.spacing.xs }}>
            <Text role="caption" color="mutedForeground" style={{ fontWeight: '700', fontSize: 12 }}>
              {t('notif.filters.animal')}
            </Text>
            {selectedAnimals.length > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: colors.card,
                  borderRadius: tokens.radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <PressableSurface
                  accessibilityRole="button"
                  accessibilityLabel={t('notif.filters.animal')}
                  pressedStyle="overlay"
                  onPress={() => setAnimalModalOpen(true)}
                  testID="notif-filter-pick-animal"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}
                >
                  <CowIcon size={16} color={colors.primary} />
                  {selectedAnimals.length === 1 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                      <Text role="caption" color="primary" style={{ fontWeight: '700', fontSize: 13 }}>
                        #{selectedAnimals[0].tagNumber}
                      </Text>
                      {selectedAnimals[0].name ? (
                        <Text
                          role="caption"
                          color="foreground"
                          style={{ fontWeight: '600', fontSize: 13, flexShrink: 1 }}
                          numberOfLines={1}
                        >
                          {selectedAnimals[0].name}
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text role="caption" color="foreground" style={{ fontWeight: '700', fontSize: 13 }}>
                      {t('notif.filters.animalsSelected', { count: selectedAnimals.length })}
                    </Text>
                  )}
                </PressableSurface>
                <PressableSurface
                  accessibilityRole="button"
                  accessibilityLabel={t('notif.filters.clear')}
                  pressedStyle="overlay"
                  onPress={() => setSelectedAnimals([])}
                  testID="notif-filter-clear-animal"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: tokens.radius.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.muted,
                  }}
                >
                  <XIcon size={14} color={colors.foreground} />
                </PressableSurface>
              </View>
            ) : (
              <PressableSurface
                accessibilityRole="button"
                accessibilityLabel={t('notif.filters.animal')}
                pressedStyle="overlay"
                onPress={() => setAnimalModalOpen(true)}
                testID="notif-filter-pick-animal"
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: colors.card,
                  borderRadius: tokens.radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 44,
                }}
              >
                <Text role="caption" color="mutedForeground" style={{ fontWeight: '600', fontSize: 13 }}>
                  {t('notif.filters.allAnimals')}
                </Text>
              </PressableSurface>
            )}
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View
          style={{
            flexDirection: 'row',
            gap: tokens.spacing.sm,
            paddingTop: tokens.spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flex: 1 }}>
            <Button
              label={t('notif.filters.reset')}
              variant="secondary"
              size="md"
              onPress={handleResetFilters}
              testID="notif-filter-reset-all"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={t('notif.filters.apply')}
              variant="primary"
              size="md"
              onPress={() => setFilterModalOpen(false)}
              testID="notif-filter-apply"
            />
          </View>
        </View>
      </SheetModal>

      {/* 4. Animal Picker Bottom Sheet Modal */}
      <SheetModal
        visible={animalModalOpen}
        onRequestClose={() => setAnimalModalOpen(false)}
        testID="notif-animal-picker-modal"
        scrollable={false}
        heightFraction={0.75}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: tokens.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <SheetTitle>{t('notif.new.animalsLabel')}</SheetTitle>
          <IconButton
            icon="close"
            accessibilityLabel={t('common.close')}
            variant="ghost"
            size="md"
            onPress={() => setAnimalModalOpen(false)}
            testID="notif-animal-picker-close"
          />
        </View>

        <View style={{ paddingVertical: tokens.spacing.sm }}>
          <TextInput
            value={animalSearch}
            onChangeText={setAnimalSearch}
            placeholder={t('notif.new.animalsPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            testID="notif-animal-picker-search"
            style={{
              height: 40,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              borderRadius: tokens.radius.md,
              paddingHorizontal: tokens.spacing.sm,
              color: colors.foreground,
              backgroundColor: colors.card,
              fontSize: 14,
            }}
          />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 4, paddingBottom: tokens.spacing.sm }}
        >
          {filteredAnimals.map((animal) => {
            const isSelected = selectedAnimals.some((a) => a.id === animal.id);
            return (
              <PressableSurface
                key={animal.id}
                accessibilityRole="button"
                accessibilityLabel={`${animal.tagNumber} ${animal.name || ''}`}
                pressedStyle="overlay"
                onPress={() => {
                  setSelectedAnimals((prev) =>
                    prev.some((a) => a.id === animal.id)
                      ? prev.filter((a) => a.id !== animal.id)
                      : [...prev, animal],
                  );
                }}
                testID={`notif-animal-item-${animal.id}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: tokens.spacing.sm,
                  paddingHorizontal: tokens.spacing.sm,
                  borderRadius: tokens.radius.md,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? colors.muted : colors.card,
                  minHeight: 44,
                }}
              >
                <View style={{ gap: 2 }}>
                  <Text role="caption" color="primary" style={{ fontWeight: '700', fontSize: 13 }}>
                    #{animal.tagNumber}
                  </Text>
                  {animal.name ? (
                    <Text role="caption" color="foreground" style={{ fontSize: 13 }}>
                      {animal.name}
                    </Text>
                  ) : null}
                </View>

                {isSelected ? <CheckIcon size={18} color={colors.primary} /> : null}
              </PressableSurface>
            );
          })}
        </ScrollView>

        <View style={{ paddingTop: tokens.spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Button
            label={t('notif.filters.done')}
            variant="primary"
            size="md"
            onPress={() => setAnimalModalOpen(false)}
            testID="notif-animal-picker-done"
          />
        </View>
      </SheetModal>
    </SheetModal>
  );
});
