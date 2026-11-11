/**
 * StatusBadge (spec 2.6): a non-interactive word + mark. The word is always `foreground` on the tint fill (never
 * mutedForeground on a tint); the mark (glyph, or a dot for herd state) is decorative. radius.md, not a full pill, so a
 * label that wraps at 200% still reads as a badge. One accessible text node named by the label.
 */
import { View } from 'react-native';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius, spacing } from '../../theme/tokens.ts';
import type { ScriptChoice } from '../../theme/font-family.ts';
import { Glyph } from '../internal/Glyph.tsx';
import { Text } from '../primitives/Text.tsx';
import { statusStyle, type HerdState, type StatusTone } from './status-style.ts';

export type { HerdState, StatusTone };

export type StatusBadgeProps = { label: string; script?: ScriptChoice; testID?: string } & (
  | { tone: StatusTone; herdState?: never }
  | { herdState: HerdState; tone?: never }
);

export function StatusBadge(props: StatusBadgeProps) {
  const { colors } = useTheme();
  const { label, script, testID } = props;
  const look = statusStyle(props.tone !== undefined ? { tone: props.tone } : { herdState: props.herdState! });

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        minHeight: 28,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.md,
        backgroundColor: colors[look.fill],
        ...(look.border ? { borderWidth: 1, borderColor: colors[look.border] } : null),
      }}
    >
      <Glyph name={look.markGlyph} size={16} color={look.markColor} />
      <Text role="label" color="foreground" script={script} style={{ flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
}
