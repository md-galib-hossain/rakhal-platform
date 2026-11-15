import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider.tsx';
import { Button } from '../../src/components/actions/Button.tsx';
import { ConfirmSheet } from '../../src/components/feedback/ConfirmSheet.tsx';
import { Heading, Text } from '../../src/components/primitives/Text.tsx';
import { useFormat } from '../../src/i18n/useFormat.ts';
import { useSync } from '../../src/offline/SyncProvider.tsx';
import { useLocale } from '../../src/providers/LocaleProvider.tsx';
import { useTheme } from '../../src/providers/ThemeProvider.tsx';

// More (PRD 6.3): account actions now; the module list (reproduction, healthcare, calves, inventory, finance, reports,
// settings) is added with those modules, each row gated by its permission through `can`.
export default function More() {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const { user, farmName, signOut } = useAuth();
  const sync = useSync();
  const format = useFormat();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Entries still on the phone (waiting, not sent, or needing review): signing out would delete them (ADR-006 section 8).
  const unsent = sync.snapshot.waiting + sync.snapshot.failed + sync.snapshot.conflict;

  // Sign out always empties the offline cache; unsent entries need the user's yes first.
  async function finishSignOut() {
    setSigningOut(true);
    try {
      await sync.clearAll();
    } finally {
      setSigningOut(false);
      setConfirmSignOut(false);
    }
    await signOut();
  }
  const onSignOut = () => (unsent > 0 ? setConfirmSignOut(true) : void finishSignOut());

  // Development only: queue one harmless milk entry (a day 400 days out, first cached cow) to try the offline queue by hand.
  async function queueDevEntry() {
    const [cow] = await sync.readCache('cattle', { limit: 1 });
    if (!cow || typeof cow.id !== 'string') return;
    const date = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10);
    await sync.enqueue({
      endpoint: 'milk.saveLog',
      method: 'POST',
      path: '/milk/log',
      body: { date, session: 'MORNING', entries: [{ cattleId: cow.id, yieldL: 1, baseUpdatedAt: null }] },
    });
  }

  return (
    <ScrollView
      testID="screen-more"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: tokens.spacing.xl, gap: tokens.spacing.lg }}
    >
      <Heading role="h2">{t('more.account')}</Heading>
      <Text>{user ? user.name : t('home.signedIn')}</Text>
      {farmName ? <Text color="mutedForeground">{farmName}</Text> : null}
      <Button label={t('home.changeFarm')} variant="secondary" onPress={() => router.push('/farm')} />
      <Button label={t('home.signOut')} variant="ghost" size="md" onPress={onSignOut} testID="sign-out" />
      <ConfirmSheet
        visible={confirmSignOut}
        title={t('sync.signOut.title')}
        message={t('sync.signOut.message', { count: format.numberSafe(unsent) })}
        confirmLabel={t('sync.signOut.confirm')}
        tone="destructive"
        loading={signingOut}
        onConfirm={() => void finishSignOut()}
        onCancel={() => setConfirmSignOut(false)}
      />
      {__DEV__ ? (
        <Button label="Queue a test milk entry (dev)" variant="secondary" size="md" onPress={() => void queueDevEntry()} testID="dev-queue" />
      ) : null}
      {__DEV__ ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/dev/gallery')}
          style={{ minHeight: tokens.touchTarget.min, justifyContent: 'center' }}
        >
          <Text color="primary">{t('gallery.title')}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
