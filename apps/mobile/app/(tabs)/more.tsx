import { router } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider.tsx';
import { Button } from '../../src/components/actions/Button.tsx';
import { Heading, Text } from '../../src/components/primitives/Text.tsx';
import { useLocale } from '../../src/providers/LocaleProvider.tsx';
import { useTheme } from '../../src/providers/ThemeProvider.tsx';

// More (PRD 6.3): account actions now; the module list (reproduction, healthcare, calves, inventory, finance, reports,
// settings) is added with those modules, each row gated by its permission through `can`.
export default function More() {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const { user, farmName, signOut } = useAuth();
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
      <Button label={t('home.signOut')} variant="ghost" size="md" onPress={() => void signOut()} />
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
