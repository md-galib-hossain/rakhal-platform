import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
import { Card } from '../components/display/Card.tsx';
import { StatusBadge } from '../components/display/StatusBadge.tsx';
import { ConfirmSheet } from '../components/feedback/ConfirmSheet.tsx';
import { Heading, Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { describePill } from '../offline/describe-row.ts';
import { useSync } from '../offline/SyncProvider.tsx';
import { SyncSheet } from '../offline/SyncSheet.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';

/**
 * More / Settings screen (WP6, expanded with detailed sync & offline status).
 * Shows account info, farm switching, sign-out confirmation, and detailed sync status.
 * ADR-007 compliant: no drop shadows, 1px borders and tokens only.
 */
export function MoreScreen() {
  const { colors, tokens } = useTheme();
  const { t, locale, setLocale } = useLocale();
  const { user, farmName, signOut } = useAuth();
  const sync = useSync();
  const format = useFormat();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showSyncSheet, setShowSyncSheet] = useState(false);

  // Entries still on the phone (waiting, not sent, or needing review): signing out deletes them (ADR-006 section 8).
  const unsent = sync.snapshot.waiting + sync.snapshot.failed + sync.snapshot.conflict;

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

  // Development only: queue one harmless milk entry to try the offline queue by hand.
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

  const pill = describePill(sync.snapshot);
  const params = pill.params?.count !== undefined ? { count: format.numberSafe(pill.params.count as number) } : undefined;
  const pillLabel = t(pill.key, params);

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

      {/* Settings / Language Section */}
      <Card testID="more-language-section" padding="lg" style={{ gap: tokens.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Heading role="h2">{t('common.language')}</Heading>
          <View
            style={{
              flexDirection: 'row',
              borderRadius: tokens.radius.full,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              overflow: 'hidden',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('language.bn')}
              accessibilityState={{ selected: locale === 'bn' }}
              testID="more-language-bn"
              onPress={() => setLocale('bn')}
              style={{
                paddingVertical: tokens.spacing.xs,
                paddingHorizontal: tokens.spacing.md,
                minWidth: 48,
                minHeight: 36,
                borderRadius: tokens.radius.full,
                backgroundColor: locale === 'bn' ? colors.primary : colors.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                weight="semibold"
                color={locale === 'bn' ? 'primaryForeground' : 'foreground'}
                style={{ fontSize: 13 }}
              >
                বাং
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('language.en')}
              accessibilityState={{ selected: locale === 'en' }}
              testID="more-language-en"
              onPress={() => setLocale('en')}
              style={{
                paddingVertical: tokens.spacing.xs,
                paddingHorizontal: tokens.spacing.md,
                minWidth: 48,
                minHeight: 36,
                borderRadius: tokens.radius.full,
                backgroundColor: locale === 'en' ? colors.primary : colors.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                weight="semibold"
                color={locale === 'en' ? 'primaryForeground' : 'foreground'}
                style={{ fontSize: 13 }}
              >
                EN
              </Text>
            </Pressable>
          </View>
        </View>
      </Card>

      {/* Detailed Sync & Offline Status Section */}
      <Card testID="more-sync-section" padding="lg" style={{ gap: tokens.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Heading role="h2">{t('more.sync')}</Heading>
          <StatusBadge label={pillLabel} tone={pill.tone} testID="more-sync-badge" />
        </View>

        <Text role="body" color="mutedForeground" testID="more-last-updated">
          {sync.snapshot.lastSyncedAt !== null
            ? t('more.lastSynced', { time: format.dateTimeSafe(sync.snapshot.lastSyncedAt) })
            : t('more.neverSynced')}
        </Text>

        {sync.snapshot.waiting > 0 ? (
          <Text role="body" color="warningText" testID="more-pending-count">
            {t('more.pendingCount', { count: format.numberSafe(sync.snapshot.waiting) })}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: tokens.spacing.sm, marginTop: tokens.spacing.xs }}>
          <View style={{ flex: 1 }}>
            <Button
              label={t('sync.sheet.syncNow')}
              variant="secondary"
              size="md"
              onPress={() => void sync.syncNow()}
              testID="more-sync-now"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={t('more.viewSyncSheet')}
              variant="secondary"
              size="md"
              onPress={() => setShowSyncSheet(true)}
              testID="more-view-sync-sheet"
            />
          </View>
        </View>
      </Card>

      <SyncSheet visible={showSyncSheet} onClose={() => setShowSyncSheet(false)} />

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
        <Button
          label="Queue a test milk entry (dev)"
          variant="secondary"
          size="md"
          onPress={() => void queueDevEntry()}
          testID="dev-queue"
        />
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
