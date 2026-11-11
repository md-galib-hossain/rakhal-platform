/**
 * Glyph (spec 2.0): the 8 icons WP5 needs, drawn with plain Views so no icon library or SVG dependency is added.
 * 2dp stroke, fixed square box (a non-text, non-interactive box, so a fixed width/height is allowed here), always
 * decorative (hidden from accessibility: a word or the parent's label carries the meaning), colour = token name only.
 */
import { View, type ViewStyle } from 'react-native';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import type { AnyColorName } from '../../theme/tokens.ts';

export type GlyphName = 'plus' | 'minus' | 'check' | 'close' | 'chevronRight' | 'exclamation' | 'info' | 'dot';
export type GlyphSize = 16 | 20 | 24;

export const GLYPH_NAMES: readonly GlyphName[] = [
  'plus',
  'minus',
  'check',
  'close',
  'chevronRight',
  'exclamation',
  'info',
  'dot',
];

const STROKE = 2;
const POINT = 3; // the dot of "!" and "i": a 2dp point is too small to read at 16dp

export interface GlyphProps {
  name: GlyphName;
  size?: GlyphSize;
  color: AnyColorName;
  testID?: string;
}

/** A centred bar `length` long and STROKE thick, optionally rotated, offset from the box centre. */
function bar(size: number, length: number, color: string, opts: { rotate?: string; dx?: number; dy?: number; horizontal?: boolean } = {}): ViewStyle {
  const horizontal = opts.horizontal !== false;
  const w = horizontal ? length : STROKE;
  const h = horizontal ? STROKE : length;
  return {
    position: 'absolute',
    left: (size - w) / 2 + (opts.dx ?? 0),
    top: (size - h) / 2 + (opts.dy ?? 0),
    width: w,
    height: h,
    borderRadius: STROKE / 2,
    backgroundColor: color,
    transform: opts.rotate ? [{ rotate: opts.rotate }] : undefined,
  };
}

function point(size: number, color: string, dy: number): ViewStyle {
  return {
    position: 'absolute',
    left: (size - POINT) / 2,
    top: (size - POINT) / 2 + dy,
    width: POINT,
    height: POINT,
    borderRadius: POINT / 2,
    backgroundColor: color,
  };
}

/** Rotated box with two bordered edges: a check (right+bottom edges) or a chevron (top+right edges). */
function cornerMark(size: number, edge: number, color: string, kind: 'check' | 'chevron'): ViewStyle {
  const isCheck = kind === 'check';
  const w = isCheck ? edge * 0.55 : edge;
  const h = isCheck ? edge * 1.05 : edge;
  // The rotated corner sits visually off-centre; nudge it back (check up a little, chevron left a little).
  const dx = isCheck ? 0 : -size * 0.1;
  const dy = isCheck ? -size * 0.06 : 0;
  return {
    position: 'absolute',
    left: (size - w) / 2 + dx,
    top: (size - h) / 2 + dy,
    width: w,
    height: h,
    borderColor: color,
    ...(isCheck ? { borderRightWidth: STROKE, borderBottomWidth: STROKE } : { borderTopWidth: STROKE, borderRightWidth: STROKE }),
    transform: [{ rotate: '45deg' }],
  };
}

function parts(name: GlyphName, size: number, c: string): ViewStyle[] {
  const long = Math.round(size * 0.6);
  switch (name) {
    case 'plus':
      return [bar(size, long, c), bar(size, long, c, { horizontal: false })];
    case 'minus':
      return [bar(size, long, c)];
    case 'close': {
      const diagonal = Math.round(size * 0.7);
      return [bar(size, diagonal, c, { rotate: '45deg' }), bar(size, diagonal, c, { rotate: '-45deg' })];
    }
    case 'check':
      return [cornerMark(size, Math.round(size * 0.5), c, 'check')];
    case 'chevronRight':
      return [cornerMark(size, Math.round(size * 0.4), c, 'chevron')];
    case 'exclamation': {
      const stem = Math.round(size * 0.4);
      return [bar(size, stem, c, { horizontal: false, dy: -size * 0.12 }), point(size, c, size * 0.28)];
    }
    case 'info': {
      const stem = Math.round(size * 0.4);
      return [point(size, c, -size * 0.28), bar(size, stem, c, { horizontal: false, dy: size * 0.12 })];
    }
    case 'dot': {
      const d = Math.round((size * 5) / 8); // 10dp in the 16dp box
      return [
        {
          position: 'absolute',
          left: (size - d) / 2,
          top: (size - d) / 2,
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: c,
        },
      ];
    }
  }
}

export function Glyph({ name, size = 20, color, testID }: GlyphProps) {
  const { colors } = useTheme();
  const resolved = colors[color];
  return (
    <View
      testID={testID ?? `glyph-${name}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: size, height: size }}
    >
      {parts(name, size, resolved).map((style, i) => (
        <View key={i} style={style} />
      ))}
    </View>
  );
}
