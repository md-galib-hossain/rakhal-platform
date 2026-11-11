/**
 * Card (spec 2.8 / 2.7): a static surface. `card` fill, `radius.lg`, hairline `border` (decorative), `elevation.card`.
 * No interactive behaviour (ListRow is the pressable one). Not an a11y node unless `accessibilityLabel` is given,
 * in which case it groups its children under that name. Do not nest focusable controls in an `overflow: hidden`
 * parent of the card: the focus ring sits outside the control.
 */
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { elevation, radius, shadowColor, spacing } from '../../theme/tokens.ts';

export type CardPadding = 'none' | 'md' | 'lg';

export const CARD_PADDING: Readonly<Record<CardPadding, number>> = { none: 0, md: spacing.md, lg: spacing.lg };

export interface CardProps {
  children: ReactNode;
  /** Default `md` (12). */
  padding?: CardPadding;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function Card({ children, padding = 'md', style, testID, accessibilityLabel }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: CARD_PADDING[padding],
          shadowColor,
          ...elevation.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
