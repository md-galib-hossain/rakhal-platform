/**
 * Button (spec 2.1): every labelled action. Built on PressableSurface (focus ring, pressed look, busy/disabled).
 * Sizes use minHeight only (never a fixed height on a text holder); the label wraps and centres, no numberOfLines.
 * `loading` keeps the label and variant look, shows a spinner in the leading slot, ignores presses and reports
 * busy + disabled. The caller passes an already-translated label.
 */
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius } from '../../theme/tokens.ts';
import type { ScriptChoice } from '../../theme/font-family.ts';
import { Glyph, type GlyphName } from '../internal/Glyph.tsx';
import { PressableSurface } from '../internal/PressableSurface.tsx';
import { pressedFillName } from '../internal/press-overlay.ts';
import { Text } from '../primitives/Text.tsx';
import {
  BUTTON_ICON_GAP,
  BUTTON_ICON_SIZE,
  BUTTON_METRICS,
  buttonColors,
  defaultButtonSize,
  type ButtonSize,
  type ButtonVariant,
} from './button-style.ts';

export type { ButtonSize, ButtonVariant };

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** md = 48, lg = 56. Default: lg for primary, md otherwise. */
  size?: ButtonSize;
  /** Default true (stretches); false = intrinsic width. */
  fullWidth?: boolean;
  leadingIcon?: GlyphName;
  loading?: boolean;
  disabled?: boolean;
  script?: ScriptChoice;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size,
  fullWidth = true,
  leadingIcon,
  loading = false,
  disabled = false,
  script,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const metrics = BUTTON_METRICS[size ?? defaultButtonSize(variant)];
  const look = buttonColors(variant, disabled);
  const pressedFill = pressedFillName(variant);

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      pressedStyle={pressedFill ? { fill: pressedFill } : 'overlay'}
      disabled={disabled}
      busy={loading}
      onPress={onPress}
      testID={testID}
      style={{
        ...metrics,
        // Square minimum so an intrinsic-width (fullWidth=false) button is never narrower than its own target.
        minWidth: metrics.minHeight,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: BUTTON_ICON_GAP,
        borderWidth: 1,
        borderRadius: radius.md,
        backgroundColor: look.fill === 'transparent' ? 'transparent' : colors[look.fill],
        borderColor: look.border === 'transparent' ? 'transparent' : colors[look.border],
      }}
    >
      {loading ? (
        <View
          testID="button-spinner"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: BUTTON_ICON_SIZE, height: BUTTON_ICON_SIZE, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator size="small" color={colors[look.label]} />
        </View>
      ) : leadingIcon ? (
        <Glyph name={leadingIcon} size={BUTTON_ICON_SIZE} color={look.label} />
      ) : null}
      <Text role="button" color={look.label} script={script} style={{ flexShrink: 1, textAlign: 'center' }}>
        {label}
      </Text>
    </PressableSurface>
  );
}
