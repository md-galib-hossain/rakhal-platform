/**
 * Modernised top header: displays the brand logo on the left and a notification bell button on the right.
 * Farm switching lives in the More tab, and language toggle lives in More / Settings.
 * Seamless white canvas (colors.card) flowing directly into the screen content without divider line clutter.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationIcon } from '../assets/icons/NotificationIcon.tsx';
import { RakhalLogo } from '../assets/icons/RakhalLogo.tsx';
import { WifiOffIcon } from '../cattle/CattleIcons.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { useNotificationContext } from '../notifications/NotificationContext.tsx';
import { useSync } from '../offline/SyncProvider.tsx';
import { SyncSheet } from '../offline/SyncSheet.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';

export function AppHeader() {
  const { t } = useLocale();
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { openNotifications, unreadCount } = useNotificationContext();
  const { ready, snapshot } = useSync();
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);

  const isOffline = ready && snapshot?.state === 'offline';

  return (
    <>
      <View
        testID="app-header"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + tokens.spacing.xs,
          paddingBottom: tokens.spacing.xs,
          paddingLeft: insets.left + tokens.spacing.lg,
          paddingRight: insets.right + tokens.spacing.lg,
          backgroundColor: colors.card,
        }}
      >
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <RakhalLogo
            testID="app-header-logo"
            height={22}
            width={100}
            color={colors.foreground}
            accentColor={colors.primary}
            accessibilityLabel={t('common.appName')}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
          {isOffline ? (
            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel={t('sync.pill.offline')}
              pressedStyle="overlay"
              onPress={() => setSyncSheetOpen(true)}
              testID="header-offline"
              style={{
                width: 40,
                height: 40,
                borderRadius: tokens.radius.full,
                borderWidth: 1,
                borderColor: colors.warningEdge,
                backgroundColor: colors.warningTint,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              hitSlop={tokens.spacing.xs}
            >
              <WifiOffIcon size={18} color={colors.warningText} />
            </PressableSurface>
          ) : null}

          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={t('common.notifications')}
            pressedStyle="overlay"
            onPress={() => openNotifications()}
            testID="header-notifications"
            style={{
              width: 40,
              height: 40,
              borderRadius: tokens.radius.full,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
            }}
            hitSlop={tokens.spacing.xs}
          >
            <NotificationIcon size={20} color={colors.foreground} />
            {unreadCount > 0 ? (
              <View
                testID="header-unread-dot"
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.primary,
                }}
              />
            ) : null}
          </PressableSurface>
        </View>
      </View>

      <SyncSheet visible={syncSheetOpen} onClose={() => setSyncSheetOpen(false)} />
    </>
  );
}
