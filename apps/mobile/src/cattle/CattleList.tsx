/**
 * Searchable list of animals over the offline cache (WP9 & Redesign).
 * Matches the Milk page visual architecture:
 * - Clean white canvas (colors.card) with 1px border separation and zero drop shadows (ADR-007 compliant).
 * - Highlights KPI Bar: Total Animals, Avg Herd AQR, Breeding Ready, Milking Cows.
 * - Horizontal Category Filter Chips: All, Cows, Heifers, Calves, Milking, Dry, Pregnant, Sick, etc.
 * - Modern search bar with loupe icon and clear button.
 * - Rich Animal Cards with avatar tint, metadata grid, AQR score box, next event banner, and status badges.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { SkeletonList } from '../components/display/Skeleton.tsx';
import { EmptyState, ErrorState } from '../components/feedback/StateMessage.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { CattleCard } from './CattleCard.tsx';
import { CattleHighlightsBar } from './CattleHighlightsBar.tsx';
import { SearchIcon } from './CattleIcons.tsx';
import {
  computeCategoryCounts,
  computeCattleHighlights,
  matchesCategoryChip,
  type CattleCategoryChipKey,
  type CattleListItem,
} from './cattle-model.ts';
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

  const [localSearch, setLocalSearch] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CattleCategoryChipKey>('ALL');

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

  // Filter items by category
  const displayedItems = useMemo(() => {
    if (selectedCategory === 'ALL') return items;
    return items.filter((item) => matchesCategoryChip(item, selectedCategory));
  }, [items, selectedCategory]);

  const renderItem = useCallback(
    ({ item }: { item: CattleListItem }) => (
      <CattleCard
        item={item}
        disabled={isDisabled?.(item) ?? false}
        onSelect={onSelect}
        testID={`cattle-row-${item.id}`}
      />
    ),
    [isDisabled, onSelect],
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
        {/* 1. Highlights KPI & Category Pills Bar */}
        <CattleHighlightsBar
          highlights={highlights}
          categoryCounts={categoryCounts}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* 2. All Animals Section Header + Search & Count */}
        <View style={{ gap: tokens.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text role="title" color="foreground" style={{ fontWeight: '700', fontSize: 16 }}>
              {t('cattle.highlights.allAnimals')}
            </Text>
            {status === 'ready' && displayedItems.length > 0 ? (
              <Text role="label" color="mutedForeground" testID="cattle-count" accessibilityLiveRegion="polite">
                {t('cattle.count', { count: format.numberSafe(displayedItems.length) })}
              </Text>
            ) : null}
          </View>

          {/* Search Input Bar (matching MilkScreen design) */}
          <View
            style={{
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
            <SearchIcon size={18} color={colors.mutedForeground} />
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
                fontSize: 14,
                paddingVertical: tokens.spacing.xs,
                paddingRight: localSearch.length > 0 ? 32 : 8,
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
                  width: 30,
                  height: 30,
                  borderRadius: tokens.radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Glyph name="close" size={16} color="mutedForeground" />
              </PressableSurface>
            ) : null}
          </View>

          {/* Sync / Offline Notes */}
          {notes.map((line) => (
            <Note key={line.id} text={line.text} testID={`cattle-note-${line.id}`} />
          ))}
        </View>
      </View>
    ),
    [
      highlights,
      categoryCounts,
      selectedCategory,
      displayedItems.length,
      status,
      localSearch,
      onSearchChange,
      clearSearch,
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
        testID="cattle-flatlist"
        data={displayedItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        contentContainerStyle={{
          paddingHorizontal: tokens.spacing.md,
          paddingTop: tokens.spacing.xs,
          paddingBottom: 140,
          gap: tokens.spacing.sm,
        }}
      />
    );
  }

  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: colors.card }}>
      {content}
    </View>
  );
}
