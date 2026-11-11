import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { RootErrorBoundary } from '../src/components/RootErrorBoundary.tsx';
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
        <Slot />
      </RootErrorBoundary>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <Shell />
    </AppProviders>
  );
}
