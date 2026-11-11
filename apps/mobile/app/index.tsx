import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heading, Text } from '../src/components/primitives/Text.tsx';
import { useLocale } from '../src/providers/LocaleProvider.tsx';
import { useTheme } from '../src/providers/ThemeProvider.tsx';

// Placeholder screen: the real home arrives with its WP. It renders inside AppProviders (root layout), so it uses
// the theme/locale primitives; expo-router supplies the SafeAreaProvider that the insets come from.
export default function Index() {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + tokens.spacing.xxl,
        paddingBottom: insets.bottom + tokens.spacing.xxl,
        paddingLeft: insets.left + tokens.spacing.xxl,
        paddingRight: insets.right + tokens.spacing.xxl,
        gap: tokens.spacing.lg,
      }}
    >
      <Heading>{t('common.appName')}</Heading>
      {__DEV__ ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/dev/gallery')}
          style={{ minHeight: tokens.touchTarget.min, justifyContent: 'center' }}
        >
          <Text color="primary">{t('gallery.title')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
