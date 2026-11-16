/**
 * One bottom-tab button (WP6, modernized with Flaticon SVG icons and active pill).
 * Rendered through `TabTrigger asChild`, which hands it `isFocused` and `onPress`.
 * A tab the account may not see renders nothing.
 *
 * 56dp minimum height, touch targets >= 48dp, label always visible,
 * selected = brand active pill + primary label + top accent bar + selected state.
 * ADR-007 compliant: no drop shadows, 1px borders and token fills only.
 */
import type { ReactNode } from 'react';
import type { PressableProps } from 'react-native';
import { View } from 'react-native';
import {
  CattleIcon,
  FeedIcon,
  HealthIcon,
  HomeIcon,
  MilkIcon,
  MoreIcon,
  TasksIcon,
} from '../assets/icons/index.ts';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import type { TabConfig, TabKey } from './nav-config.ts';

export interface TabButtonProps {
  tab: TabConfig;
  visible: boolean;
  /** Injected by `TabTrigger asChild`. */
  isFocused?: boolean;
  onPress?: PressableProps['onPress'];
}

function renderTabIcon(key: TabKey | string, color: string, isFocused: boolean): ReactNode {
  const size = 22;
  switch (key) {
    case 'home':
      return <HomeIcon size={size} color={color} focused={isFocused} />;
    case 'cattle':
      return <CattleIcon size={size} color={color} focused={isFocused} />;
    case 'milk':
      return <MilkIcon size={size} color={color} focused={isFocused} />;
    case 'tasks':
      return <TasksIcon size={size} color={color} focused={isFocused} />;
    case 'feed':
      return <FeedIcon size={size} color={color} focused={isFocused} />;
    case 'health':
      return <HealthIcon size={size} color={color} focused={isFocused} />;
    case 'more':
    default:
      return <MoreIcon size={size} color={color} focused={isFocused} />;
  }
}

export function TabButton({ tab, visible, isFocused = false, onPress }: TabButtonProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  if (!visible) return null;

  const activeColor = colors.primaryText;
  const inactiveColor = colors.mutedForeground;
  const iconColor = isFocused ? activeColor : inactiveColor;

  return (
    <PressableSurface
      accessibilityRole="tab"
      accessibilityLabel={t(tab.labelKey)}
      accessibilityState={{ selected: isFocused }}
      pressedStyle="overlay"
      onPress={onPress}
      testID={`tab-${tab.key}`}
      style={{
        flex: 1,
        minHeight: tokens.touchTarget.primary,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: tokens.spacing.xs,
      }}
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
      <View
        testID={`tab-${tab.key}-pill`}
        style={{
          paddingHorizontal: tokens.spacing.md,
          paddingVertical: 2,
          borderRadius: tokens.radius.full,
          backgroundColor: isFocused ? colors.successTint : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {renderTabIcon(tab.key, iconColor, isFocused)}
      </View>
      <Text
        role="caption"
        color={isFocused ? 'primaryText' : 'mutedForeground'}
        style={{ textAlign: 'center', marginTop: 2 }}
      >
        {t(tab.labelKey)}
      </Text>
    </PressableSurface>
  );
}
