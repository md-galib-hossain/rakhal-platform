import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthProvider.tsx';
import { Button } from '../src/components/actions/Button.tsx';
import { Heading, Text } from '../src/components/primitives/Text.tsx';
import { useLocale } from '../src/providers/LocaleProvider.tsx';
import { useTheme } from '../src/providers/ThemeProvider.tsx';

// Signed-in placeholder: the real home (priorities, quick actions) arrives with the navigation shell (WP6). It renders
// inside AppProviders > AuthProvider (root layout); the AuthGate guarantees a signed-in user with a farm lands here.
export default function Index() {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const { user, signOut } = useAuth();
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
      <Text color="mutedForeground">
        {user ? t('home.signedInAs', { name: user.name }) : t('home.signedIn')}
      </Text>
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
    </View>
  );
}
