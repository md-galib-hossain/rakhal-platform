/**
 * Searchable list of animals over the offline cache (WP9 & Redesign).
 * Matches the Milk page visual architecture:
 * - Clean white canvas (colors.card) with 1px border separation and zero drop shadows (ADR-007 compliant).
 * - Highlights KPI Bar: Total Animals, Avg Herd AQR, Breeding Ready, Milking Cows.
 * - Horizontal Category Filter Chips: All, Cows, Heifers, Calves, Milking, Dry, Pregnant, Sick, etc.
 * - Modern search bar with loupe icon and clear button.
 * - Actions bar: "+ Add Animal" button, "Filters" drilldown modal with badge, "Groups" drawer modal.
 * - Active dismissible filter pills strip with "Clear all".
 * - Rich Animal Cards with avatar tint, metadata grid, AQR score box, next event banner, and animated accordion.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, FlatList, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/actions/Button.tsx';
import { SkeletonList } from '../components/display/Skeleton.tsx';
import { EmptyState, ErrorState } from '../components/feedback/StateMessage.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { AnimalGroupsSheet } from './AnimalGroupsSheet.tsx';
import { AddAnimalModal } from './AddAnimalModal.tsx';
import { BulkAddToGroupModal } from './BulkAddToGroupModal.tsx';
import { BulkChangeShedModal } from './BulkChangeShedModal.tsx';
import { BulkDisposeModal } from './BulkDisposeModal.tsx';
import { BulkEventModal } from './BulkEventModal.tsx';
import { CattleBulkDock } from './CattleBulkDock.tsx';
import { CattleCard } from './CattleCard.tsx';
import { CattleFilterSheet } from './CattleFilterSheet.tsx';
import { CattleHighlightsBar, CattleCategoryChips } from './CattleHighlightsBar.tsx';
import { FilterIcon, SearchIcon, UsersIcon } from './CattleIcons.tsx';
import { UpcomingEventsSheet } from './UpcomingEventsSheet.tsx';
import {
  computeCategoryCounts,
  computeCattleHighlights,
  countActiveFilters,
  matchesCategoryChip,
  matchesCattleFilters,
  type CattleCategoryChipKey,
  type CattleFilterState,
  type CattleListItem,
} from './cattle-model.ts';
import { useAnimalGroups } from './useAnimalGroups.ts';
import { useCattleList } from './useCattleList.ts';

export interface CattleListProps {
  onSelect: (item: CattleListItem) => void;
  /** A disabled row is shown but cannot be pressed. */
  isDisabled?: (item: CattleListItem) => boolean;
  /** Replaces the status badge on the right of a row (for backward compatibility). */
  renderTrailing?: (item: CattleListItem) => ReactNode;
  /** Keep the "last updated" and offline lines (default true). A picker inside a sheet may hide them. */
  showSyncNotes?: boolean;
  testID?: string;
}

function Note({ text, testID }: { text: string; testID: string }) {
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Glyph name="info" size={16} color="infoText" />
      <Text role="label" color="foreground" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

export function CattleList({
  onSelect,
  isDisabled,
  showSyncNotes = true,
  testID,
}: CattleListProps) {
  const { t } = useLocale();
  const format = useFormat();
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();

  const [localSearch, setLocalSearch] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CattleCategoryChipKey>('ALL');
  const [sheetItem, setSheetItem] = useState<CattleListItem | null>(null);

  // Filters & Animal Groups modal state
  const [filterState, setFilterState] = useState<CattleFilterState>({});
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [groupsSheetOpen, setGroupsSheetOpen] = useState(false);
  const [activeGroupName, setActiveGroupName] = useState<string | null>(null);

  // Bulk Selection & Modals state
  const [containerHeight, setContainerHeight] = useState(0);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEventOpen, setBulkEventOpen] = useState(false);
  const [bulkShedOpen, setBulkShedOpen] = useState(false);
  const [bulkGroupOpen, setBulkGroupOpen] = useState(false);
  const [bulkDisposeOpen, setBulkDisposeOpen] = useState(false);
  const [addAnimalOpen, setAddAnimalOpen] = useState(false);

  const { groups: animalGroups, reload: reloadGroups } = useAnimalGroups();

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(localSearch);
    }, 150);
    return () => clearTimeout(timer);
  }, [localSearch]);

  const onSearchChange = useCallback((text: string) => {
    setLocalSearch(text);
    if (!text.trim()) {
      setSearch('');
    }
  }, []);

  const clearSearch = useCallback(() => {
    setLocalSearch('');
    setSearch('');
  }, []);

  const { items, status, hasSynced, syncState, reload } = useCattleList({ search });
  const searching = search.trim() !== '';

  // Highlights & Category Counts computed directly from cached items (100% offline)
  const highlights = useMemo(() => computeCattleHighlights(items), [items]);
  const categoryCounts = useMemo(() => computeCategoryCounts(items), [items]);

  const activeFilterCount = useMemo(() => countActiveFilters(filterState), [filterState]);

  // Filter items by category AND multi-dimensional filters
  const displayedItems = useMemo(() => {
    let list = items;
    if (selectedCategory !== 'ALL') {
      list = list.filter((item) => matchesCategoryChip(item, selectedCategory));
    }
    if (activeFilterCount > 0) {
      list = list.filter((item) => matchesCattleFilters(item, filterState));
    }
    return list;
  }, [items, selectedCategory, activeFilterCount, filterState]);

  const handleFilterByGroup = useCallback(
    (groupId: string | null, groupName?: string) => {
      setFilterState((prev) => ({ ...prev, animalGroupId: groupId }));
      setActiveGroupName(groupId ? (groupName ?? groupId) : null);
    },
    [],
  );

  const handleClearAllFilters = useCallback(() => {
    setFilterState({});
    setActiveGroupName(null);
  }, []);

  const handleAddAnimalPress = useCallback(() => {
    setAddAnimalOpen(true);
  }, []);

  // Bulk Selection Handlers
  const toggleSelectItem = useCallback((item: CattleListItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      if (next.size === 0) {
        setIsSelectionMode(false);
      }
      return next;
    });
  }, []);

  const handleLongPressItem = useCallback((item: CattleListItem) => {
    setIsSelectionMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(displayedItems.map((i) => i.id)));
  }, [displayedItems]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }, []);

  const handleCancelSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    setBulkEventOpen(false);
    setBulkShedOpen(false);
    setBulkGroupOpen(false);
    setBulkDisposeOpen(false);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: CattleListItem }) => (
      <CattleCard
        item={item}
        disabled={isDisabled?.(item) ?? false}
        onSelect={onSelect}
        onOpenUpcomingEvents={setSheetItem}
        testID={`cattle-row-${item.id}`}
        isSelectionMode={isSelectionMode}
        isSelected={selectedIds.has(item.id)}
        onToggleSelect={toggleSelectItem}
        onLongPress={handleLongPressItem}
      />
    ),
    [isDisabled, onSelect, isSelectionMode, selectedIds, toggleSelectItem, handleLongPressItem],
  );

  const notes = useMemo(() => {
    if (!showSyncNotes) return [];
    const lines: { id: string; text: string }[] = [];
    if (syncState === 'offline') lines.push({ id: 'offline', text: t('cattle.offline') });
    return lines;
  }, [showSyncNotes, syncState, t]);

  const renderHeader = useCallback(
    () => (
      <View style={{ gap: tokens.spacing.md, paddingBottom: tokens.spacing.xs }}>
        {/* 1. Highlights KPI Bar (Non-sticky) */}
        <CattleHighlightsBar
          highlights={highlights}
          categoryCounts={categoryCounts}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          showCategoryChips={false}
        />
      </View>
    ),
    [
      highlights,
      categoryCounts,
      selectedCategory,
      setSelectedCategory,
      tokens,
    ],
  );

  const renderStickyControls = useCallback(
    () => (
      <View
        style={{
          gap: tokens.spacing.sm,
          paddingHorizontal: tokens.spacing.md,
          paddingTop: tokens.spacing.xs,
          paddingBottom: tokens.spacing.sm,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        {/* 1. Horizontal Category Filter Chips */}
        <CattleCategoryChips
          categoryCounts={categoryCounts}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* 2. All Animals Section Header + Add Animal Button */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
            {status === 'ready' && displayedItems.length > 0 ? (
              <Text role="title" color="foreground" style={{ fontWeight: '700', fontSize: 18 }} testID="cattle-count" accessibilityLiveRegion="polite">
                {t('cattle.count', { count: format.numberSafe(displayedItems.length) })}
              </Text>
            ) : (
              <Text role="title" color="foreground" style={{ fontWeight: '700', fontSize: 18 }}>
                {t('cattle.highlights.allAnimals')}
              </Text>
            )}
          </View>

          {/* Action buttons: Add New Animal */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
            <Button
              label={t('cattle.actions.addAnimal')}
              leadingIcon="plus"
              variant="primary"
              size="md"
              fullWidth={false}
              onPress={handleAddAnimalPress}
              testID="cattle-add-animal-btn"
            />
          </View>
        </View>

        {/* 3. Single Row: Search Input + Filters Button + Groups Button */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs + 2 }}>
          {/* Search Input Bar */}
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: tokens.touchTarget.min,
              height: tokens.touchTarget.min,
              paddingLeft: tokens.spacing.sm,
              paddingRight: tokens.spacing.xs,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: tokens.radius.md,
              gap: tokens.spacing.xs,
            }}
          >
            <SearchIcon size={16} color={colors.mutedForeground} />
            <TextInput
              testID="cattle-search"
              value={localSearch}
              onChangeText={onSearchChange}
              placeholder={t('cattle.search.placeholder')}
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={{
                flex: 1,
                color: colors.foreground,
                fontSize: 13,
                paddingVertical: tokens.spacing.xs,
                paddingRight: localSearch.length > 0 ? 28 : 4,
              }}
            />
            {localSearch.length > 0 ? (
              <PressableSurface
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                pressedStyle="overlay"
                onPress={clearSearch}
                testID="cattle-search-clear"
                hitSlop={tokens.spacing.xs}
                style={{
                  position: 'absolute',
                  right: 8,
                  width: 28,
                  height: 28,
                  borderRadius: tokens.radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Glyph name="close" size={16} color="mutedForeground" />
              </PressableSurface>
            ) : null}
          </View>

          {/* Filters Button */}
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={t('cattle.actions.openFilters')}
            pressedStyle="overlay"
            onPress={() => setFilterSheetOpen(true)}
            testID="cattle-filters-button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: tokens.touchTarget.min,
              minHeight: tokens.touchTarget.min,
              height: tokens.touchTarget.min,
              paddingHorizontal: tokens.spacing.xs + 2,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: activeFilterCount > 0 ? colors.primaryEdge : colors.border,
              backgroundColor: activeFilterCount > 0 ? colors.successTint : colors.card,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <FilterIcon size={18} color={activeFilterCount > 0 ? colors.primary : colors.foreground} />
            {activeFilterCount > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  backgroundColor: colors.primary,
                  minWidth: 16,
                  height: 16,
                  borderRadius: tokens.radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 3,
                }}
              >
                <Text role="caption" color="primaryForeground" style={{ fontWeight: '700', fontSize: 9, lineHeight: 11 }}>
                  {activeFilterCount}
                </Text>
              </View>
            ) : null}
          </PressableSurface>

          {/* Animal Groups Button */}
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={t('cattle.actions.openGroups')}
            pressedStyle="overlay"
            onPress={() => setGroupsSheetOpen(true)}
            testID="cattle-groups-button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: tokens.touchTarget.min,
              height: tokens.touchTarget.min,
              paddingHorizontal: tokens.spacing.sm,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: filterState.animalGroupId ? colors.primaryEdge : colors.border,
              backgroundColor: filterState.animalGroupId ? colors.successTint : colors.card,
              gap: 4,
              flexShrink: 0,
            }}
          >
            <UsersIcon size={15} color={filterState.animalGroupId ? colors.primary : colors.foreground} />
            <Text
              role="body"
              color={filterState.animalGroupId ? 'primary' : 'foreground'}
              style={{ fontSize: 13, fontWeight: filterState.animalGroupId ? '700' : '600' }}
              numberOfLines={1}
            >
              {t('cattle.actions.openGroups')}
            </Text>
            {animalGroups.length > 0 ? (
              <Text
                role="caption"
                color={filterState.animalGroupId ? 'primary' : 'mutedForeground'}
                style={{ fontSize: 11, fontWeight: '700' }}
              >
                ({animalGroups.length})
              </Text>
            ) : null}
          </PressableSurface>
        </View>

        {/* Active Filter Dismissible Chips Row */}
        {activeFilterCount > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: tokens.spacing.xs, alignItems: 'center', paddingVertical: 2 }}
            testID="cattle-active-filters-bar"
          >
            {filterState.animalGroupId ? (
              <PressableSurface
                accessibilityRole="button"
                accessibilityLabel="Remove group filter"
                pressedStyle="overlay"
                onPress={() => handleFilterByGroup(null)}
                testID="cattle-chip-remove-group"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingLeft: 10,
                  paddingRight: 6,
                  paddingVertical: 5,
                  borderRadius: tokens.radius.full,
                  backgroundColor: colors.successTint,
                  borderWidth: 1,
                  borderColor: colors.primaryEdge,
                }}
              >
                <Text role="caption" color="primary" style={{ fontWeight: '700', fontSize: 12 }}>
                  {t('cattle.filters.chip.group', { name: activeGroupName ?? filterState.animalGroupId })}
                </Text>
                <Glyph name="close" size={16} color="primary" />
              </PressableSurface>
            ) : null}

            {filterState.animalCategory ? (
              <PressableSurface
                accessibilityRole="button"
                accessibilityLabel="Remove category filter"
                pressedStyle="overlay"
                onPress={() => setFilterState((prev) => ({ ...prev, animalCategory: null }))}
                testID="cattle-chip-remove-category"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingLeft: 10,
                  paddingRight: 6,
                  paddingVertical: 5,
                  borderRadius: tokens.radius.full,
                  backgroundColor: colors.secondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 12 }}>
                  {filterState.animalCategory}
                </Text>
                <Glyph name="close" size={16} color="mutedForeground" />
              </PressableSurface>
            ) : null}

            {filterState.productionStatus ? (
              <PressableSurface
                accessibilityRole="button"
                accessibilityLabel="Remove production filter"
                pressedStyle="overlay"
                onPress={() => setFilterState((prev) => ({ ...prev, productionStatus: null }))}
                testID="cattle-chip-remove-production"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingLeft: 10,
                  paddingRight: 6,
                  paddingVertical: 5,
                  borderRadius: tokens.radius.full,
                  backgroundColor: colors.secondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 12 }}>
                  {filterState.productionStatus}
                </Text>
                <Glyph name="close" size={16} color="mutedForeground" />
              </PressableSurface>
            ) : null}

            {filterState.lactationStage ? (
              <PressableSurface
                accessibilityRole="button"
                accessibilityLabel="Remove lactation filter"
                pressedStyle="overlay"
                onPress={() => setFilterState((prev) => ({ ...prev, lactationStage: null }))}
                testID="cattle-chip-remove-lactation"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingLeft: 10,
                  paddingRight: 6,
                  paddingVertical: 5,
                  borderRadius: tokens.radius.full,
                  backgroundColor: colors.secondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 12 }}>
                  {filterState.lactationStage}
                </Text>
                <Glyph name="close" size={16} color="mutedForeground" />
              </PressableSurface>
            ) : null}

            {filterState.reproductiveStatus ? (
              <PressableSurface
                accessibilityRole="button"
                accessibilityLabel="Remove reproduction filter"
                pressedStyle="overlay"
                onPress={() => setFilterState((prev) => ({ ...prev, reproductiveStatus: null }))}
                testID="cattle-chip-remove-reproduction"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingLeft: 10,
                  paddingRight: 6,
                  paddingVertical: 5,
                  borderRadius: tokens.radius.full,
                  backgroundColor: colors.secondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 12 }}>
                  {filterState.reproductiveStatus}
                </Text>
                <Glyph name="close" size={16} color="mutedForeground" />
              </PressableSurface>
            ) : null}

            {filterState.healthStatus ? (
              <PressableSurface
                accessibilityRole="button"
                accessibilityLabel="Remove health filter"
                pressedStyle="overlay"
                onPress={() => setFilterState((prev) => ({ ...prev, healthStatus: null }))}
                testID="cattle-chip-remove-health"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingLeft: 10,
                  paddingRight: 6,
                  paddingVertical: 5,
                  borderRadius: tokens.radius.full,
                  backgroundColor: colors.secondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 12 }}>
                  {filterState.healthStatus}
                </Text>
                <Glyph name="close" size={16} color="mutedForeground" />
              </PressableSurface>
            ) : null}

            {/* Clear all text button */}
            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel={t('cattle.filters.clearAll')}
              pressedStyle="overlay"
              onPress={handleClearAllFilters}
              testID="cattle-clear-all-filters"
              style={{ paddingHorizontal: 8, paddingVertical: 5 }}
            >
              <Text role="caption" color="destructive" style={{ fontWeight: '700', fontSize: 12 }}>
                {t('cattle.filters.clearAll')}
              </Text>
            </PressableSurface>
          </ScrollView>
        ) : null}

        {/* Sync / Offline Notes */}
        {notes.map((line) => (
          <Note key={line.id} text={line.text} testID={`cattle-note-${line.id}`} />
        ))}
      </View>
    ),
    [
      categoryCounts,
      selectedCategory,
      setSelectedCategory,
      displayedItems.length,
      status,
      localSearch,
      onSearchChange,
      clearSearch,
      activeFilterCount,
      filterState,
      activeGroupName,
      handleFilterByGroup,
      handleClearAllFilters,
      handleAddAnimalPress,
      animalGroups.length,
      notes,
      colors,
      tokens,
      t,
      format,
    ],
  );

  let content: ReactNode;
  if (status === 'error') {
    content = <ErrorState title={t('cattle.error.title')} message={t('cattle.error.message')} onRetry={reload} testID="cattle-error" />;
  } else if (status === 'loading' || (items.length === 0 && !hasSynced && syncState === 'syncing')) {
    content = <SkeletonList rows={7} />;
  } else if (items.length === 0 && searching) {
    content = (
      <View style={{ gap: tokens.spacing.md }}>
        {renderHeader()}
        {renderStickyControls()}
        <EmptyState
          testID="cattle-no-match"
          title={t('cattle.noMatch.title')}
          description={t('cattle.noMatch.message', { query: search.trim() })}
        />
      </View>
    );
  } else if (items.length === 0 && !hasSynced) {
    content = (
      <EmptyState
        testID="cattle-not-downloaded"
        title={t('cattle.notDownloaded.title')}
        description={t('cattle.notDownloaded.message')}
      />
    );
  } else if (items.length === 0) {
    content = <EmptyState testID="cattle-empty" title={t('cattle.empty.title')} description={t('cattle.empty.message')} />;
  } else if (displayedItems.length === 0) {
    content = (
      <View style={{ gap: tokens.spacing.md }}>
        {renderHeader()}
        {renderStickyControls()}
        <EmptyState
          testID="cattle-no-match"
          title={t('cattle.noMatch.title')}
          description={t('cattle.noMatch.message', { query: search.trim() || selectedCategory })}
        />
      </View>
    );
  } else {
    content = (
      <FlatList
        data={displayedItems}
        extraData={[isSelectionMode, selectedIds]}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            <View style={{ paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.md }}>
              {renderHeader()}
            </View>
            {renderStickyControls()}
          </>
        }
        stickyHeaderIndices={[0]}
        contentContainerStyle={{
          paddingBottom: selectedIds.size > 0 ? 80 + insets.bottom : tokens.spacing.md,
          backgroundColor: colors.card,
        }}
        ItemSeparatorComponent={() => <View style={{ height: tokens.spacing.sm }} />}
      />
    );
  }

  const handleViewAnimalFromUpcoming = useCallback(
    (item: CattleListItem) => {
      setSheetItem(null);
      onSelect(item);
    },
    [onSelect],
  );

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.card }}
      testID={testID}
      onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
    >
      {content}

      {/* Bulk Action Dock */}
      {selectedIds.size > 0 ? (
        <CattleBulkDock
          containerHeight={containerHeight}
          selectedCount={selectedIds.size}
          totalCount={displayedItems.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onRecordEvent={() => setBulkEventOpen(true)}
          onChangeShed={() => setBulkShedOpen(true)}
          onAddToGroup={() => setBulkGroupOpen(true)}
          onDispose={() => setBulkDisposeOpen(true)}
          onCancel={handleCancelSelection}
        />
      ) : null}

      {/* Modal 1: Bulk Record Event */}
      <BulkEventModal
        visible={bulkEventOpen}
        onClose={() => setBulkEventOpen(false)}
        selectedIds={Array.from(selectedIds)}
        onSuccess={(msg) => {
          handleCancelSelection();
          void reload();
          Alert.alert('', msg);
        }}
      />

      {/* Modal 2: Bulk Change Shed */}
      <BulkChangeShedModal
        visible={bulkShedOpen}
        onClose={() => setBulkShedOpen(false)}
        selectedIds={Array.from(selectedIds)}
        onSuccess={(msg) => {
          handleCancelSelection();
          void reload();
          Alert.alert('', msg);
        }}
      />

      {/* Modal 3: Bulk Add To Group */}
      <BulkAddToGroupModal
        visible={bulkGroupOpen}
        onClose={() => setBulkGroupOpen(false)}
        selectedIds={Array.from(selectedIds)}
        onSuccess={(msg) => {
          handleCancelSelection();
          void reload();
          void reloadGroups();
          Alert.alert('', msg);
        }}
      />

      {/* Modal 4: Bulk Dispose */}
      <BulkDisposeModal
        visible={bulkDisposeOpen}
        onClose={() => setBulkDisposeOpen(false)}
        selectedIds={Array.from(selectedIds)}
        onSuccess={(msg) => {
          handleCancelSelection();
          void reload();
          Alert.alert('', msg);
        }}
      />

      {/* Modal 5: Add Animal Modal */}
      <AddAnimalModal
        visible={addAnimalOpen}
        onClose={() => setAddAnimalOpen(false)}
        onSuccess={(msg) => {
          void reload();
          void reloadGroups();
          Alert.alert('', msg);
        }}
      />

      {/* Sheet 1: Upcoming Events Detail Sheet */}
      <UpcomingEventsSheet
        item={sheetItem}
        visible={sheetItem !== null}
        onClose={() => setSheetItem(null)}
        onView={handleViewAnimalFromUpcoming}
      />

      {/* Sheet 2: Multi-dimensional Filters Sheet */}
      <CattleFilterSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        activeFilters={filterState}
        onApplyFilters={setFilterState}
        groups={animalGroups}
      />

      {/* Sheet 3: Animal Groups Drawer Sheet */}
      <AnimalGroupsSheet
        visible={groupsSheetOpen}
        onClose={() => setGroupsSheetOpen(false)}
        allAnimals={items}
        activeGroupId={filterState.animalGroupId}
        onFilterByGroup={handleFilterByGroup}
        groups={animalGroups}
        onRefreshGroups={reloadGroups}
      />
    </View>
  );
}
