import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AuthGate } from '../src/auth/AuthGate.tsx';
import { AuthProvider } from '../src/auth/AuthProvider.tsx';
import { RootErrorBoundary } from '../src/components/RootErrorBoundary.tsx';
import { NotificationProvider } from '../src/notifications/NotificationContext.tsx';
import { SyncProvider } from '../src/offline/SyncProvider.tsx';
import { AppProviders } from '../src/providers/AppProviders.tsx';
import { useTheme } from '../src/providers/ThemeProvider.tsx';
import { holdSplash } from '../src/providers/useAppReady.ts';

// Keep the native splash up from module load; AppProviders (useAppReady) releases it once fonts + prefs are ready.
holdSplash();

/** Inside the provider tree so the root background follows the theme (no white frame on dark). */
function Shell() {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootErrorBoundary>
        <AuthGate>
          <NotificationProvider>
            <Slot />
          </NotificationProvider>
        </AuthGate>
      </RootErrorBoundary>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <AuthProvider>
        <SyncProvider>
          <Shell />
        </SyncProvider>
      </AuthProvider>
    </AppProviders>
  );
}
