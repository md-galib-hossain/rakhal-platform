import Svg, { Path, Circle, G } from 'react-native-svg';
import type { IconProps } from './types.ts';

/**
 * Cattle icon (D9 Flaticon): cow head silhouette with horns, ears, and snout.
 */
export function CattleIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {/* Left horn */}
        <Path d="M6 7.5C4.5 4.5 5 2.5 7 2.5" />
        {/* Right horn */}
        <Path d="M18 7.5C19.5 4.5 19 2.5 17 2.5" />
        {/* Left ear */}
        <Path d="M6 9C3.8 9 2.5 10 2.5 11.2C2.5 12.5 4.5 13 6.5 11.5" />
        {/* Right ear */}
        <Path d="M18 9C20.2 9 21.5 10 21.5 11.2C21.5 12.5 19.5 13 17.5 11.5" />
        {/* Head outline */}
        <Path d="M7 6.5H17C17.8 6.5 18.5 9 18.5 12.5C18.5 14.5 17.5 15.5 16.5 15.5H7.5C6.5 15.5 5.5 14.5 5.5 12.5C5.5 9 6.2 6.5 7 6.5Z" />
        {/* Snout / Muzzle */}
        <Path d="M7.5 15H16.5C17.5 15 18 16 18 17.5C18 19.5 16.5 21 14.5 21H9.5C7.5 21 6 19.5 6 17.5C6 16 6.5 15 7.5 15Z" />
        {/* Nostrils */}
        <Circle cx="9.5" cy="18" r="0.75" fill={color} />
        <Circle cx="14.5" cy="18" r="0.75" fill={color} />
        {/* Eyes */}
        <Circle cx="9" cy="11.5" r="0.75" fill={color} />
        <Circle cx="15" cy="11.5" r="0.75" fill={color} />
      </G>
    </Svg>
  );
}
