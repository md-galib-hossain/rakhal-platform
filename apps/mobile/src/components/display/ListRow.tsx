/**
 * ListRow (spec 2.8): one row of a list of cards (animals, sessions, entries). Never a table.
 *
 * - Pressable (`onPress`): one accessible `button` node built on PressableSurface (inset focus ring, 12% pressed
 *   overlay), name = merged title + subtitle + trailing text unless `accessibilityLabel` is given. Chevron on the right
 *   unless `showChevron={false}`. Not pressable: a plain View, no role.
 * - minHeight 64 (two-line) / 56 (one-line), never a fixed height. No numberOfLines: text wraps.
 * - Above STACK_AT_FONT_SCALE the trailing content moves below the text column (chevron stays right).
 * - Selected: 4dp leading `primaryEdge` stripe + `check` glyph + accessibilityState.selected; surface unchanged.
 * - Disabled: muted title, presses ignored. No loading state (use SkeletonList).
 * Callers pass already-formatted strings.
 */
import type { ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import type { ScriptChoice } from '../../theme/font-family.ts';
import { Glyph } from '../internal/Glyph.tsx';
import { PressableSurface } from '../internal/PressableSurface.tsx';
import { Text } from '../primitives/Text.tsx';
import {
  LIST_ROW_METRICS,
  LIST_ROW_SURFACE,
  listRowColors,
  listRowMinHeight,
  listRowStacksTrailing,
  showsChevron,
} from './list-row-style.ts';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** e.g. a big tag number or avatar. */
  leading?: ReactNode;
  /** e.g. a StatusBadge. */
  trailing?: ReactNode;
  /** Makes it a button row; shows a chevron unless `showChevron` is false. */
  onPress?: () => void;
  showChevron?: boolean;
  selected?: boolean;
  disabled?: boolean;
  divider?: boolean;
  titleScript?: ScriptChoice;
  subtitleScript?: ScriptChoice;
  /** Optional: children text is merged. Needed in practice when `trailing` is icon-only. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  showChevron,
  selected = false,
  disabled = false,
  divider = false,
  titleScript,
  subtitleScript,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ListRowProps) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const look = listRowColors(disabled);
  const pressable = onPress !== undefined;
  const hasTrailing = trailing !== undefined && trailing !== null && trailing !== false;
  const stacked = listRowStacksTrailing(fontScale, hasTrailing);
  const chevron = showsChevron(pressable, showChevron);

  const rowStyle = {
    minHeight: listRowMinHeight(subtitle !== undefined),
    paddingHorizontal: LIST_ROW_METRICS.paddingHorizontal,
    paddingVertical: LIST_ROW_METRICS.paddingVertical,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LIST_ROW_METRICS.gap,
    backgroundColor: colors[LIST_ROW_SURFACE],
  } as const;

  const content = (
    <>
      {selected ? (
        <View
          testID="list-row-stripe"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: LIST_ROW_METRICS.stripe,
            backgroundColor: colors[look.stripe],
          }}
        />
      ) : null}
      {leading ? <View style={{ flexShrink: 0 }}>{leading}</View> : null}
      <View testID="list-row-text" style={{ flex: 1, gap: stacked ? LIST_ROW_METRICS.paddingVertical : 0 }}>
        <Text role="title" color={look.title} script={titleScript}>
          {title}
        </Text>
        {subtitle !== undefined ? (
          <Text role="body" color={look.subtitle} script={subtitleScript}>
            {subtitle}
          </Text>
        ) : null}
        {stacked ? (
          <View testID="list-row-trailing" style={{ alignSelf: 'flex-start' }}>
            {trailing}
          </View>
        ) : null}
      </View>
      {hasTrailing && !stacked ? (
        <View testID="list-row-trailing" style={{ flexShrink: 0 }}>
          {trailing}
        </View>
      ) : null}
      {selected ? <Glyph name="check" size={LIST_ROW_METRICS.glyphSize} color={look.check} /> : null}
      {chevron ? <Glyph name="chevronRight" size={LIST_ROW_METRICS.glyphSize} color={look.chevron} /> : null}
    </>
  );

  return (
    <View style={{ backgroundColor: colors[LIST_ROW_SURFACE] }}>
      {pressable ? (
        <PressableSurface
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ selected }}
          pressedStyle="overlay"
          focusInset
          disabled={disabled}
          onPress={onPress}
          style={rowStyle}
        >
          {content}
        </PressableSurface>
      ) : (
        <View
          testID={testID}
          accessible={accessibilityLabel !== undefined ? true : undefined}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ selected, disabled }}
          style={rowStyle}
        >
          {content}
        </View>
      )}
      {divider ? (
        <View
          testID="list-row-divider"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            height: LIST_ROW_METRICS.dividerThickness,
            marginHorizontal: LIST_ROW_METRICS.dividerInset,
            backgroundColor: colors[look.divider],
          }}
        />
      ) : null}
    </View>
  );
}
