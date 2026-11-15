/**
 * Shell header (WP6): the active farm's name (tap to switch farm) and a language toggle. The sync status pill joins it
 * with the offline foundation (WP8b). Falls back to the app name while the farm name is not known.
 */
import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { SyncStatusPill } from '../offline/SyncStatusPill.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';

export function AppHeader() {
  const { farmName } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();

  const title = farmName ?? t('common.appName');
  const otherLocale = locale === 'bn' ? 'en' : 'bn';

  return (
    <View
      testID="app-header"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        paddingTop: insets.top + tokens.spacing.xs,
        paddingBottom: tokens.spacing.xs,
        paddingLeft: insets.left + tokens.spacing.lg,
        paddingRight: insets.right + tokens.spacing.lg,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={t('home.changeFarm')}
        accessibilityHint={title}
        pressedStyle="overlay"
        onPress={() => router.push('/farm')}
        testID="header-farm"
        style={{ flex: 1, minHeight: tokens.touchTarget.min, justifyContent: 'center', borderRadius: tokens.radius.md }}
      >
        <Text role="h2" numberOfLines={1}>
          {title}
        </Text>
      </PressableSurface>
      <SyncStatusPill />
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={t('common.language')}
        pressedStyle="overlay"
        onPress={() => setLocale(otherLocale)}
        testID="header-language"
        style={{
          minHeight: tokens.touchTarget.min,
          minWidth: tokens.touchTarget.min,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: tokens.spacing.md,
          borderRadius: tokens.radius.md,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        }}
      >
        <Text role="label">{otherLocale === 'bn' ? 'বাংলা' : 'English'}</Text>
      </PressableSurface>
    </View>
  );
}
