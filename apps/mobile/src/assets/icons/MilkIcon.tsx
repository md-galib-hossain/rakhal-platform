import Svg, { Path, G } from 'react-native-svg';
import type { IconProps } from './types.ts';

/**
 * Milk icon (Official Lucide `milk`): 24x24 2dp stroke geometry.
 */
export function MilkIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M8 2H16" />
        <Path d="M9 2V5" />
        <Path d="M15 2V5" />
        <Path d="M6 8C6 7.44772 6.44772 7 7 7H17C17.5523 7 18 7.44772 18 8L19 20C19 21.1046 18.1046 22 17 22H7C5.89543 22 5 21.1046 5 20L6 8Z" />
        <Path d="M5.5 14H18.5" />
      </G>
    </Svg>
  );
}
