import Svg, { Path, G } from 'react-native-svg';
import type { IconProps } from './types.ts';

/**
 * Home icon (D9 Flaticon): farm house / barn silhouette.
 */
export function HomeIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M3 10L12 3L21 10V20C21 20.55 20.55 21 20 21H4C3.45 21 3 20.55 3 20V10Z" />
        <Path d="M9 21V12H15V21" />
      </G>
    </Svg>
  );
}
