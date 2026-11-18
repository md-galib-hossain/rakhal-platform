import Svg, { Circle, G } from 'react-native-svg';
import type { IconProps } from './types.ts';

/**
 * More icon (Official Lucide `more-horizontal`): 24x24 2dp stroke geometry.
 */
export function MoreIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G fill={color}>
        <Circle cx="12" cy="12" r="1.75" />
        <Circle cx="19" cy="12" r="1.75" />
        <Circle cx="5" cy="12" r="1.75" />
      </G>
    </Svg>
  );
}
