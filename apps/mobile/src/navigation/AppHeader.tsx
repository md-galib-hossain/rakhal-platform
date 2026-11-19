/**
 * Modernised top header: displays the brand app name on the left and a notification bell button on the right.
 * Farm switching lives in the More tab, and language toggle lives in More / Settings.
 * Clean white canvas (colors.card) with 1px borderBottomColor (colors.border).
 */
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationIcon } from '../assets/icons/NotificationIcon.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';

export function AppHeader() {
  const { t } = useLocale();
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
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
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text role="h2" style={{ fontWeight: '800', fontSize: 18 }}>
          {t('common.appName')}
        </Text>
      </View>
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={t('common.notifications')}
        pressedStyle="overlay"
        onPress={() => {}}
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
        }}
        hitSlop={tokens.spacing.xs}
      >
        <NotificationIcon size={24} color={colors.foreground} />
      </PressableSurface>
    </View>
  );
}
