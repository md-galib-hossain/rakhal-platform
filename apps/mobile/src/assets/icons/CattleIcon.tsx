import Svg, { Path, Circle, G } from 'react-native-svg';
import type { IconProps } from './types.ts';

/**
 * Cattle icon (Lucide style): clean 24x24 2dp stroke geometry.
 */
export function CattleIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {/* Left & right horns */}
        <Path d="M5 8C4 5 5 3 7 3" />
        <Path d="M19 8C20 5 19 3 17 3" />
        {/* Left & right ears */}
        <Path d="M5 9.5C3 10 2 11.5 3 12.5C4 13 5.5 12 6 10.5" />
        <Path d="M19 9.5C21 10 22 11.5 21 12.5C20 13 18.5 12 18 10.5" />
        {/* Head silhouette */}
        <Path d="M6 7H18V13C18 15.5 16.5 16.5 15.5 16.5H8.5C7.5 16.5 6 15.5 6 13V7Z" />
        {/* Muzzle */}
        <Path d="M7 16H17V19C17 20.1 16.1 21 15 21H9C7.9 21 7 20.1 7 19V16Z" />
        {/* Nostrils */}
        <Circle cx="10" cy="18.5" r="0.75" fill={color} />
        <Circle cx="14" cy="18.5" r="0.75" fill={color} />
      </G>
    </Svg>
  );
}
