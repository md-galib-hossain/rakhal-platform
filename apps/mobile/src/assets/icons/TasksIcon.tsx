import Svg, { Path, Rect, G } from 'react-native-svg';
import type { IconProps } from './types.ts';

/**
 * Tasks icon (Official Lucide `clipboard-check`): 24x24 2dp stroke geometry.
 */
export function TasksIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Rect width={8} height={4} x={8} y={2} rx={1} />
        <Path d="M16 4H18C19.1046 4 20 4.89543 20 6V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V6C4 4.89543 4.89543 4 6 4H8" />
        <Path d="M9 14L11 16L15 12" />
      </G>
    </Svg>
  );
}
