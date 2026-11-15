/**
 * Placeholder body of a tab whose real screen is a later work package (WP9 cattle, WP10 milk, WP12 tasks). The
 * permission comes from the nav config, so the gate on the screen and the tab bar can never disagree.
 */
import { View } from 'react-native';
import { EmptyState } from '../components/feedback/StateMessage.tsx';
import { TABS, type TabKey } from '../navigation/nav-config.ts';
import { PermissionGate } from '../permissions/PermissionGate.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';

export function ComingSoonScreen({ tabKey }: { tabKey: TabKey }) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const tab = TABS.find((candidate) => candidate.key === tabKey);

  return (
    <PermissionGate permission={tab?.permission ?? null}>
      <View style={{ flex: 1, backgroundColor: colors.background }} testID={`screen-${tabKey}`}>
        <EmptyState
          icon="info"
          title={t(tab?.labelKey ?? 'shell.comingSoon.title')}
          description={t('shell.comingSoon.message')}
        />
      </View>
    </PermissionGate>
  );
}
