/**
 * Searchable list of animals over the offline cache (WP9). The screen uses it to open an animal; the WP10 milk-log cow
 * picker reuses it with `onSelect`, `isDisabled` (e.g. a cow in a withholding period) and `renderTrailing` (e.g. the
 * previous yield). It never calls the network: rows come from `useCattleList`, which reads the on-phone cache.
 *
 * States: skeleton while the cache is read, an error with retry, "not downloaded yet" (never synced), "no animals",
 * "no match" for a search, and the list. Above the list: the count, an offline note, and "last updated" (stale after 24 h).
 */
import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { FlatList, View } from 'react-native';
import { ListRow } from '../components/display/ListRow.tsx';
import { SkeletonList } from '../components/display/Skeleton.tsx';
import { StatusBadge } from '../components/display/StatusBadge.tsx';
import { EmptyState, ErrorState } from '../components/feedback/StateMessage.tsx';
import { TextField } from '../components/forms/TextField.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import type { MessageKey } from '../i18n/messages.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import {
  cattleTitle,
  categoryKey,
  humanize,
  isStale,
  primaryBadge,
  type CattleListItem,
} from './cattle-model.ts';
import { useCattleList } from './useCattleList.ts';

export interface CattleListProps {
  onSelect: (item: CattleListItem) => void;
  /** A disabled row is shown but cannot be pressed. */
  isDisabled?: (item: CattleListItem) => boolean;
  /** Replaces the status badge on the right of a row. */
  renderTrailing?: (item: CattleListItem) => ReactNode;
  /** Keep the "last updated" and offline lines (default true). A picker inside a sheet may hide them. */
  showSyncNotes?: boolean;
  testID?: string;
}

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

function Badge({ item, t }: { item: CattleListItem; t: Translate }) {
  const spec = primaryBadge(item);
  const label = spec.labelKey ? t(spec.labelKey) : humanize(spec.raw ?? '');
  return 'herdState' in spec ? (
    <StatusBadge herdState={spec.herdState} label={label} />
  ) : (
    <StatusBadge tone={spec.tone} label={label} />
  );
}

interface RowProps {
  item: CattleListItem;
  disabled: boolean;
  trailing?: ReactNode;
  onSelect: (item: CattleListItem) => void;
}

const CattleRow = memo(function CattleRow({ item, disabled, trailing, onSelect }: RowProps) {
  const { t } = useLocale();
  const category = categoryKey(item.animalCategory);
  const subtitle = [category ? t(category) : null, item.breedName].filter(Boolean).join(' · ');
  return (
    <ListRow
      testID={`cattle-row-${item.id}`}
      title={cattleTitle(item) || '—'}
      subtitle={subtitle || undefined}
      trailing={trailing ?? <Badge item={item} t={t} />}
      disabled={disabled}
      divider
      onPress={() => onSelect(item)}
    />
  );
});

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

export function CattleList({ onSelect, isDisabled, renderTrailing, showSyncNotes = true, testID }: CattleListProps) {
  const { t } = useLocale();
  const format = useFormat();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const { items, status, hasSynced, lastSyncedAt, syncState, reload } = useCattleList({ search });
  const searching = search.trim() !== '';

  const renderItem = useCallback(
    ({ item }: { item: CattleListItem }) => (
      <CattleRow item={item} disabled={isDisabled?.(item) ?? false} trailing={renderTrailing?.(item)} onSelect={onSelect} />
    ),
    [isDisabled, renderTrailing, onSelect],
  );

  const notes = useMemo(() => {
    if (!showSyncNotes) return [];
    const lines: { id: string; text: string }[] = [];
    if (syncState === 'offline') lines.push({ id: 'offline', text: t('cattle.offline') });
    if (lastSyncedAt !== null) {
      const time = format.dateTimeSafe(lastSyncedAt);
      lines.push(
        isStale(lastSyncedAt, Date.now())
          ? { id: 'stale', text: t('cattle.stale', { time }) }
          : { id: 'updated', text: t('cattle.updated', { time }) },
      );
    }
    return lines;
  }, [showSyncNotes, syncState, lastSyncedAt, t, format]);

  let body: ReactNode;
  if (status === 'error') {
    body = <ErrorState title={t('cattle.error.title')} message={t('cattle.error.message')} onRetry={reload} testID="cattle-error" />;
  } else if (status === 'loading' || (items.length === 0 && !hasSynced && syncState === 'syncing')) {
    body = <SkeletonList rows={7} />;
  } else if (items.length === 0 && searching) {
    body = (
      <EmptyState
        testID="cattle-no-match"
        title={t('cattle.noMatch.title')}
        description={t('cattle.noMatch.message', { query: search.trim() })}
      />
    );
  } else if (items.length === 0 && !hasSynced) {
    body = (
      <EmptyState
        testID="cattle-not-downloaded"
        title={t('cattle.notDownloaded.title')}
        description={t('cattle.notDownloaded.message')}
      />
    );
  } else if (items.length === 0) {
    body = <EmptyState testID="cattle-empty" title={t('cattle.empty.title')} description={t('cattle.empty.message')} />;
  } else {
    body = (
      <FlatList
        testID="cattle-flatlist"
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    );
  }

  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
        <TextField
          label={t('cattle.search.label')}
          value={search}
          onChangeText={setSearch}
          placeholder={t('cattle.search.placeholder')}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID="cattle-search"
        />
        {status === 'ready' && items.length > 0 ? (
          <Text role="label" color="mutedForeground" testID="cattle-count" accessibilityLiveRegion="polite">
            {t('cattle.count', { count: format.numberSafe(items.length) })}
          </Text>
        ) : null}
        {notes.map((line) => (
          <Note key={line.id} text={line.text} testID={`cattle-note-${line.id}`} />
        ))}
      </View>
      <View style={{ flex: 1, marginTop: 8 }}>{body}</View>
    </View>
  );
}
