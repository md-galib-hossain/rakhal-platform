/**
 * IconButton (spec 2.2): an icon-only action. `accessibilityLabel` is REQUIRED by the type (there is no text to
 * name it). The visual box is the touch target (48 / 56 square, no hitSlop). Colours follow the Button variants.
 */
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius } from '../../theme/tokens.ts';
import { Glyph, type GlyphName } from '../internal/Glyph.tsx';
import { PressableSurface } from '../internal/PressableSurface.tsx';
import { pressedFillName } from '../internal/press-overlay.ts';
import { BUTTON_METRICS, buttonColors, type ButtonSize } from './button-style.ts';

export interface IconButtonProps {
  icon: GlyphName;
  /** Required, already translated. */
  accessibilityLabel: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  /** 48 / 56 square. Default md. */
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

const GLYPH_SIZE = 24;

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  testID,
}: IconButtonProps) {
  const { colors } = useTheme();
  const box = BUTTON_METRICS[size].minHeight;
  const look = buttonColors(variant, disabled);
  const pressedFill = pressedFillName(variant);

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      pressedStyle={pressedFill ? { fill: pressedFill } : 'overlay'}
      disabled={disabled}
      busy={loading}
      onPress={onPress}
      testID={testID}
      style={{
        minWidth: box,
        minHeight: box,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: radius.full,
        backgroundColor: look.fill === 'transparent' ? 'transparent' : colors[look.fill],
        borderColor: look.border === 'transparent' ? 'transparent' : colors[look.border],
      }}
    >
      {loading ? (
        <View
          testID="icon-button-spinner"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: GLYPH_SIZE, height: GLYPH_SIZE, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator size="small" color={colors[look.label]} />
        </View>
      ) : (
        <Glyph name={icon} size={GLYPH_SIZE} color={look.label} />
      )}
    </PressableSurface>
  );
}
