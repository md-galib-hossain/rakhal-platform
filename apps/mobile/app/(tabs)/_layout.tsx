import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider.tsx';
import { AppHeader } from '../../src/navigation/AppHeader.tsx';
import { TABS, visibleTabs } from '../../src/navigation/nav-config.ts';
import { TabButton } from '../../src/navigation/TabButton.tsx';
import { useLastTab } from '../../src/navigation/useLastTab.ts';
import { useLocale } from '../../src/providers/LocaleProvider.tsx';
import { useTheme } from '../../src/providers/ThemeProvider.tsx';

/**
 * Shell (WP6): header + routed screen + bottom tab bar (PRD 6.3). All five routes are always registered (so a deep
 * link resolves to the screen's PermissionGate instead of "not found"); only tabs the account may see are drawn.
 */
export default function TabsLayout() {
  const { permissions } = useAuth();
  const { t } = useLocale();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  useLastTab();

  const visible = new Set(visibleTabs(permissions).map((tab) => tab.key));

  return (
    <Tabs style={{ flex: 1, backgroundColor: colors.background }} options={{ backBehavior: 'initialRoute' }}>
      <AppHeader />
      <TabSlot style={{ flex: 1 }} />
      <TabList
        accessibilityRole="tablist"
        accessibilityLabel={t('nav.tabsLabel')}
        style={{
          flexDirection: 'row',
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
        }}
      >
        {TABS.map((tab) => (
          <TabTrigger key={tab.key} name={tab.routeName} href={tab.href} asChild>
            <TabButton tab={tab} visible={visible.has(tab.key)} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}
