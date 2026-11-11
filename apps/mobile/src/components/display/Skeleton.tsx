/**
 * Skeleton + SkeletonList (spec 2.9): placeholder blocks in the decorative `border` fill. One shared Animated opacity
 * pulse (1 <-> 0.5, 800ms ease-in-out, native driver) drives a whole list; the pulse stops on unmount and is static
 * under reduce motion. The list is ONE accessible node (label "Loading", busy); blocks are hidden from a11y.
 * Blocks use fixed heights: they hold no text, so this is allowed (spec 1.1).
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, View, type DimensionValue } from 'react-native';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius as radiusTokens, spacing } from '../../theme/tokens.ts';
import { useReduceMotion } from '../internal/useReduceMotion.ts';
import { Card } from './Card.tsx';

const PULSE_LOW = 0.5;
const PULSE_MS = 800;

/** Shared opacity loop. Under reduce motion it never starts and the value stays at 1. */
function Pulse({ children }: { children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: PULSE_LOW, duration: PULSE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: PULSE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      opacity.setValue(1);
    };
  }, [reduceMotion, opacity]);

  return (
    <Animated.View testID="skeleton-pulse" style={{ opacity }}>
      {children}
    </Animated.View>
  );
}

interface BlockProps {
  width?: DimensionValue;
  height: number;
  radius?: number;
  testID?: string;
}

function Block({ width = '100%', height, radius = radiusTokens.sm, testID }: BlockProps) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, borderRadius: radius, backgroundColor: colors.border }}
    />
  );
}

export interface SkeletonProps {
  width?: number | `${number}%`;
  height: number;
  /** Default radius.sm. */
  radius?: number;
  testID?: string;
}

/** A single pulsing block. Prefer SkeletonList for list/card shapes. */
export function Skeleton({ width, height, radius, testID }: SkeletonProps) {
  return (
    <Pulse>
      <Block width={width} height={height} radius={radius} testID={testID} />
    </Pulse>
  );
}

export interface SkeletonListProps {
  /** Default 6. */
  rows?: number;
  /** `row` mirrors ListRow (min 64dp, 40dp leading square, two text bars); `card` mirrors a Card. Default `row`. */
  variant?: 'row' | 'card';
}

function SkeletonRow() {
  return (
    <View testID="skeleton-row" style={{ minHeight: 64, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Block width={40} height={40} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Block width="60%" height={14} />
        <Block width="40%" height={12} />
      </View>
    </View>
  );
}

function SkeletonCard() {
  return (
    <Card testID="skeleton-row">
      <View style={{ minHeight: 72, gap: spacing.sm }}>
        <Block width="50%" height={16} />
        <Block height={12} />
        <Block width="70%" height={12} />
      </View>
    </Card>
  );
}

export function SkeletonList({ rows = 6, variant = 'row' }: SkeletonListProps) {
  const { t } = useLocale();
  const count = Math.max(0, Math.floor(rows));
  const Item = variant === 'card' ? SkeletonCard : SkeletonRow;
  return (
    <View accessible accessibilityLabel={t('a11y.loading')} accessibilityState={{ busy: true }} testID="skeleton-list">
      <Pulse>
        <View style={{ gap: variant === 'card' ? spacing.md : spacing.sm }}>
          {Array.from({ length: count }, (_, i) => (
            <Item key={i} />
          ))}
        </View>
      </Pulse>
    </View>
  );
}
