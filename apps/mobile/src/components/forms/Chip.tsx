/**
 * Chip and ChipGroup (spec 2.5): single-select session picker. Selection is owned by the caller.
 *
 * - Chip is a radio: role `radio`, `accessibilityState.checked`, name = label. 48dp minimum both ways, `radius.full`,
 *   label wraps (no numberOfLines) so a long Bangla label makes a taller pill instead of truncating.
 * - An 18dp leading slot is ALWAYS present so the width does not jump when selection toggles: selected = `check`
 *   glyph, unselected = the accent dot (label-only colour, never the sole signal) or an empty ring.
 * - ChipGroup is a wrapping row (no horizontal scroll) with `radiogroup` role and a REQUIRED accessibility label.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import type { ScriptChoice } from '../../theme/font-family.ts';
import { radius, spacing } from '../../theme/tokens.ts';
import { Glyph } from '../internal/Glyph.tsx';
import { PressableSurface } from '../internal/PressableSurface.tsx';
import { Text } from '../primitives/Text.tsx';
import { CHIP_METRICS, chipColors, withLineSlack } from './chip-style.ts';

export type ChipAccent = 'sessionMorning' | 'sessionNoon' | 'sessionEvening' | 'sessionNight';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Dot beside the label (label-only colour rule: the word always carries the meaning). */
  accentColor?: ChipAccent;
  disabled?: boolean;
  script?: ScriptChoice;
  testID?: string;
}

export function Chip({ label, selected, onPress, accentColor, disabled = false, script, testID }: ChipProps) {
  const { colors } = useTheme();
  const look = chipColors(selected, disabled);

  return (
    <PressableSurface
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      pressedStyle={selected && !disabled ? { fill: 'primaryHover' } : 'overlay'}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={{
        minHeight: CHIP_METRICS.minHeight,
        minWidth: CHIP_METRICS.minWidth,
        maxWidth: '100%',
        // Let the pill itself shrink to the row width so the label gets a bounded width and wraps (Android Yoga).
        flexShrink: 1,
        paddingHorizontal: CHIP_METRICS.paddingHorizontal,
        paddingVertical: CHIP_METRICS.paddingVertical,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: CHIP_METRICS.gap,
        borderWidth: 1,
        borderRadius: radius.full,
        backgroundColor: colors[look.fill],
        borderColor: colors[look.border],
      }}
    >
      <View
        testID="chip-slot"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: CHIP_METRICS.leadingSlot, height: CHIP_METRICS.leadingSlot, alignItems: 'center', justifyContent: 'center' }}
      >
        {selected ? (
          <Glyph name="check" size={16} color={look.mark} />
        ) : accentColor ? (
          <View
            testID="chip-accent-dot"
            style={{
              width: CHIP_METRICS.dot,
              height: CHIP_METRICS.dot,
              borderRadius: radius.full,
              backgroundColor: colors[accentColor],
            }}
          />
        ) : (
          <View
            testID="chip-ring"
            style={{
              width: CHIP_METRICS.ring,
              height: CHIP_METRICS.ring,
              borderRadius: radius.full,
              borderWidth: 2,
              borderColor: colors[look.mark],
            }}
          />
        )}
      </View>
      <Text role="button" color={look.label} script={script} style={{ flexShrink: 1, flexGrow: 0, textAlign: 'center' }}>
        {withLineSlack(label)}
      </Text>
    </PressableSurface>
  );
}

export interface ChipGroupProps {
  /** Required, already translated (e.g. "Milking session"). */
  accessibilityLabel: string;
  children: ReactNode;
}

export function ChipGroup({ accessibilityLabel, children }: ChipGroupProps) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
    >
      {children}
    </View>
  );
}
