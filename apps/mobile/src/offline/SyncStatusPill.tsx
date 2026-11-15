/**
 * The header's sync pill (PRD 23.3, WP8b): always says whether this phone is online and how many entries are waiting
 * ("3 pending"), with icon-free text plus a colour tone, and opens the sheet listing what is saved on the phone.
 * Hidden when offline sync is not running (signed out, or the database could not be opened).
 */
import { useState } from 'react';
import { StatusBadge } from '../components/display/StatusBadge.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { describePill } from './describe-row.ts';
import { SyncSheet } from './SyncSheet.tsx';
import { useSync } from './SyncProvider.tsx';

export function SyncStatusPill() {
  const { ready, snapshot } = useSync();
  const { t } = useLocale();
  const { tokens } = useTheme();
  const format = useFormat();
  const [open, setOpen] = useState(false);

  if (!ready) return null;
  const pill = describePill(snapshot);
  const params = pill.params?.count !== undefined ? { count: format.numberSafe(pill.params.count as number) } : undefined;
  const label = t(pill.key, params);

  return (
    <>
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('sync.pill.hint')}
        pressedStyle="overlay"
        onPress={() => setOpen(true)}
        testID="sync-pill"
        style={{ minHeight: tokens.touchTarget.min, justifyContent: 'center', borderRadius: tokens.radius.md }}
      >
        <StatusBadge label={label} tone={pill.tone} testID="sync-pill-badge" />
      </PressableSurface>
      <SyncSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
