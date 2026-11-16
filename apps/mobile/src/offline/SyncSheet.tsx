/**
 * "Saved on this phone" (PRD 23.3, WP8b): every entry the phone is holding, with its state in words and colour, and
 * the actions the user may take. Nothing here drops a write silently: failed entries stay until the user retries or
 * discards them (a discard asks first), and a conflicted milk entry keeps the server's version until the user decides.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '../components/actions/Button.tsx';
import { ListRow } from '../components/display/ListRow.tsx';
import { StatusBadge } from '../components/display/StatusBadge.tsx';
import { ConfirmSheet } from '../components/feedback/ConfirmSheet.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { conflictCount, describeRow, describeStatus } from './describe-row.ts';
import type { OutboxRow } from './outbox.ts';
import { useSync } from './SyncProvider.tsx';

/** Recently sent entries shown under the open ones, so "saved" is visible without a long list. */
const DONE_SHOWN = 3;

export interface SyncSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function SyncSheet({ visible, onClose }: SyncSheetProps) {
  const sync = useSync();
  const { t } = useLocale();
  const { tokens } = useTheme();
  const format = useFormat();
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [discarding, setDiscarding] = useState<string | null>(null);

  // Reload whenever the sheet is open and the queue changes.
  useEffect(() => {
    if (!visible) return;
    let live = true;
    void sync.list().then((all) => {
      if (!live) return;
      const open = all.filter((r) => r.status !== 'done');
      const done = all.filter((r) => r.status === 'done').slice(-DONE_SHOWN);
      setRows([...open, ...done]);
    });
    return () => {
      live = false;
    };
  }, [visible, sync]);

  const lastSynced = sync.snapshot.lastSyncedAt;

  return (
    <>
      <SheetModal visible={visible} onRequestClose={onClose} testID="sync-sheet">
        <SheetTitle>{t('sync.sheet.title')}</SheetTitle>
        <Text color="mutedForeground">
          {lastSynced === null ? t('sync.sheet.neverSynced') : t('sync.sheet.lastSynced', { time: format.dateTimeSafe(lastSynced) })}
        </Text>

        {rows.length === 0 ? (
          <Text testID="sync-empty">{t('sync.sheet.empty')}</Text>
        ) : (
          rows.map((row) => {
            const what = describeRow(row);
            const status = describeStatus(row.status);
            const title = t(what.key, {
              ...(what.count !== undefined ? { count: format.numberSafe(what.count) } : {}),
              ...(what.date ? { date: format.dateSafe(new Date(`${what.date}T00:00:00+06:00`)) } : {}),
            });
            const conflicts = conflictCount(row);
            const note =
              row.status === 'conflict' && conflicts > 0
                ? t('sync.conflict.note', { count: format.numberSafe(conflicts) })
                : row.status === 'failed'
                  ? (row.lastError ?? undefined)
                  : undefined;
            return (
              <View key={row.localId} testID={`sync-row-${row.localId}`} style={{ gap: tokens.spacing.sm }}>
                <ListRow
                  title={title}
                  subtitle={note}
                  trailing={<StatusBadge label={t(status.key)} tone={status.tone} />}
                  divider={false}
                />
                {row.status === 'failed' ? (
                  <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Button label={t('sync.sheet.retry')} variant="secondary" size="md" onPress={() => void sync.retry(row.localId)} testID={`sync-retry-${row.localId}`} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button label={t('sync.sheet.discard')} variant="ghost" size="md" onPress={() => setDiscarding(row.localId)} testID={`sync-discard-${row.localId}`} />
                    </View>
                  </View>
                ) : null}
                {row.status === 'conflict' ? (
                  <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Button label={t('sync.sheet.keepServer')} variant="secondary" size="md" onPress={() => void sync.keepServerVersion(row.localId)} testID={`sync-keep-${row.localId}`} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button label={t('sync.sheet.useMine')} variant="primary" size="md" onPress={() => void sync.useMine(row.localId)} testID={`sync-use-mine-${row.localId}`} />
                    </View>
                  </View>
                ) : null}
                {row.status === 'pending' ? (
                  <Button label={t('sync.sheet.discard')} variant="ghost" size="md" onPress={() => setDiscarding(row.localId)} testID={`sync-discard-${row.localId}`} />
                ) : null}
              </View>
            );
          })
        )}

        <Button label={t('sync.sheet.syncNow')} variant="secondary" size="md" onPress={() => void sync.syncNow()} testID="sync-now" />
        <Button label={t('common.close')} variant="ghost" size="md" onPress={onClose} testID="sync-close" />
      </SheetModal>

      <ConfirmSheet
        visible={discarding !== null}
        title={t('sync.sheet.discardTitle')}
        message={t('sync.sheet.discardMessage')}
        confirmLabel={t('sync.sheet.discard')}
        tone="destructive"
        onConfirm={() => {
          const id = discarding;
          setDiscarding(null);
          if (id) void sync.discard(id);
        }}
        onCancel={() => setDiscarding(null)}
      />
    </>
  );
}
