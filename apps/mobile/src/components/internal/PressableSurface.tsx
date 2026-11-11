/**
 * PressableSurface (spec 2.0): the one pressable every Button / IconButton / Chip / ListRow renders through. It owns
 * the focus ring (1.3), the pressed look (C3), `disabled` + `busy` handling and `accessibilityState`. No Android ripple.
 *
 * - Pressed: `'overlay'` draws a 12% `foreground` View UNDER the children (so the label is never dimmed);
 *   `{ fill }` swaps the background to that token (primary -> primaryHover).
 * - Focus: shown only on `onFocus` (hardware keyboard / switch access). Pressed never shows the ring.
 * - Busy or disabled: presses are ignored (`onPress` is not called) and both are exposed via accessibilityState.
 * - Sizing is the caller's job (`style`: minHeight/minWidth only, never a fixed height on text holders). Do not put
 *   a PressableSurface inside an `overflow: 'hidden'` parent: the ring sits 2dp outside the box and would be clipped.
 *
 * SPIKE V-C1 (outline props on Android): if `outline*` does not render on an Android Pressable, replace `ringStyle`
 * below with `focusRingFallbackStyle` applied to a wrapper View around the Pressable (see focus-ring.ts). Nothing
 * else in this file or its users changes.
 * SPIKE V-C4 is about Animated, not used here: pressed feedback is instant by design.
 */
import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import type { AnyColorName } from '../../theme/tokens.ts';
import { focusRingStyle } from './focus-ring.ts';
import { pressedOverlayStyle } from './press-overlay.ts';

export type PressedStyle = 'overlay' | { fill: AnyColorName };

export interface PressableSurfaceProps
  extends Omit<PressableProps, 'style' | 'children' | 'android_ripple' | 'disabled' | 'accessibilityRole'> {
  /** Required: every pressable declares its role. */
  accessibilityRole: AccessibilityRole;
  pressedStyle: PressedStyle;
  /** Ring drawn inside the row (ListRow) instead of 2dp outside. */
  focusInset?: boolean;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export function PressableSurface({
  pressedStyle,
  focusInset = false,
  disabled = false,
  busy = false,
  style,
  children,
  onPress,
  onFocus,
  onBlur,
  accessibilityState,
  ...rest
}: PressableSurfaceProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const inert = disabled || busy;

  const state: AccessibilityState = { ...accessibilityState, disabled: inert, busy };
  const flat = StyleSheet.flatten(style) ?? {};
  // The overlay lives inside the border box, so its radius is the outer radius minus the border.
  const overlayRadius = Math.max(0, (typeof flat.borderRadius === 'number' ? flat.borderRadius : 0) - (typeof flat.borderWidth === 'number' ? flat.borderWidth : 0));

  const handlePress = (event: GestureResponderEvent) => {
    if (inert) return;
    onPress?.(event);
  };

  return (
    <Pressable
      {...rest}
      accessible
      focusable={!inert}
      disabled={inert}
      accessibilityState={state}
      onPress={handlePress}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={({ pressed }) => {
        const isPressed = pressed && !inert;
        const ringStyle = focused && !inert && !isPressed ? focusRingStyle(colors, { inset: focusInset }) : null;
        const fillStyle = isPressed && pressedStyle !== 'overlay' ? { backgroundColor: colors[pressedStyle.fill] } : null;
        return [style, fillStyle, ringStyle];
      }}
    >
      {({ pressed }) => (
        <>
          {pressed && !inert && pressedStyle === 'overlay' ? (
            <View
              testID="pressed-overlay"
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[StyleSheet.absoluteFill, { borderRadius: overlayRadius }, pressedOverlayStyle(colors)]}
            />
          ) : null}
          {children}
        </>
      )}
    </Pressable>
  );
}
