import { View } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider.tsx';
import { Heading, Text } from '../../src/components/primitives/Text.tsx';
import { useLocale } from '../../src/providers/LocaleProvider.tsx';
import { useTheme } from '../../src/providers/ThemeProvider.tsx';

// Home placeholder: priorities, my tasks and quick actions arrive with the dashboard work (PRD 23.2). The header,
// tab bar and safe-area handling come from the tabs layout.
export default function Home() {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const { user } = useAuth();
  return (
    <View
      testID="screen-home"
      style={{ flex: 1, backgroundColor: colors.background, padding: tokens.spacing.xl, gap: tokens.spacing.lg }}
    >
      <Heading>{t('common.appName')}</Heading>
      <Text color="mutedForeground">{user ? t('home.signedInAs', { name: user.name }) : t('home.signedIn')}</Text>
    </View>
  );
}
