/**
 * One bottom-tab button (WP6). Rendered through `TabTrigger asChild`, which hands it `isFocused` and `onPress`.
 * A tab the account may not see renders nothing (its route still exists so deep links resolve to the PermissionGate).
 *
 * 56dp target, label always visible (wraps, never truncated), selected = primary label + 3dp top bar + selected state.
 * Icons are deliberately not drawn yet: no icon library is decided (UX plan Q1); label + position carry the meaning.
 */
import type { PressableProps } from 'react-native';
import { View } from 'react-native';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import type { TabConfig } from './nav-config.ts';

export interface TabButtonProps {
  tab: TabConfig;
  visible: boolean;
  /** Injected by `TabTrigger asChild`. */
  isFocused?: boolean;
  onPress?: PressableProps['onPress'];
}

export function TabButton({ tab, visible, isFocused = false, onPress }: TabButtonProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  if (!visible) return null;

  return (
    <PressableSurface
      accessibilityRole="tab"
      accessibilityLabel={t(tab.labelKey)}
      accessibilityState={{ selected: isFocused }}
      pressedStyle="overlay"
      onPress={onPress}
      testID={`tab-${tab.key}`}
      style={{ flex: 1, minHeight: tokens.touchTarget.primary, justifyContent: 'center', alignItems: 'center' }}
    >
      <View
        testID={`tab-${tab.key}-bar`}
        style={{
          position: 'absolute',
          top: 0,
          left: tokens.spacing.md,
          right: tokens.spacing.md,
          height: 3,
          borderRadius: 2,
          backgroundColor: isFocused ? colors.primaryEdge : 'transparent',
        }}
      />
      <Text role="label" color={isFocused ? 'primaryText' : 'mutedForeground'} style={{ textAlign: 'center' }}>
        {t(tab.labelKey)}
      </Text>
    </PressableSurface>
  );
}
