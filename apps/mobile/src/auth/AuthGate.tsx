/**
 * Auth gate (WP5d). Keeps the navigator (`children`, i.e. `<Slot/>`) mounted at all times and, when the auth state says
 * the current screen is wrong, redirects with `router.replace` and covers the screen with a loader until the redirect
 * has happened. The routing rule itself is `authRedirect` (pure, node-tested).
 *
 * Why an overlay and not "render a loader instead of Slot": expo-router needs the navigator mounted before
 * `router.replace` works, and unmounting it while redirecting would drop the navigation state.
 */
import { router, useRootNavigationState, useSegments } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { RakhalLogo } from '../assets/icons/RakhalLogo.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { authRedirect, gateCoversScreen } from './auth-route.ts';
import { useAuth } from './AuthProvider.tsx';

export function AuthGate({ children }: { children: ReactNode }) {
  const { status, needsFarm } = useAuth();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const { colors, tokens } = useTheme();
  const { t } = useLocale();

  const input = {
    status,
    needsFarm,
    firstSegment: (segments as string[])[0],
    isDev: __DEV__,
  };
  const target = authRedirect(input);
  const navigatorReady = Boolean(navigationState?.key);

  useEffect(() => {
    if (navigatorReady && target !== null) router.replace(target);
  }, [navigatorReady, target]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {gateCoversScreen(input) ? (
        <View
          testID="auth-gate-cover"
          accessibilityLabel={t('a11y.loading')}
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
              gap: tokens.spacing.lg,
            },
          ]}
        >
          <RakhalLogo
            testID="auth-gate-logo"
            height={32}
            width={146}
            color={colors.foreground}
            accentColor={colors.primary}
            accessibilityLabel={t('common.appName')}
          />
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}
