import Svg, { Path, Circle, G } from 'react-native-svg';
import type { IconProps } from './types.ts';

/**
 * Eye icon: 24x24 2dp stroke geometry for password reveal.
 */
export function EyeIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <Circle cx="12" cy="12" r="3" />
      </G>
    </Svg>
  );
}
