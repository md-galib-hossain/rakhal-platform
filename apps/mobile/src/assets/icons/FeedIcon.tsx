import Svg, { Path, G } from 'react-native-svg';
import type { IconProps } from './types.ts';

/**
 * Feed icon (D9 Flaticon): wheat ear / grains.
 */
export function FeedIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {/* Central stalk */}
        <Path d="M12 2V22" />
        {/* Left grains */}
        <Path d="M12 4C9.5 4 8 6 12 8" />
        <Path d="M12 9C9.5 9 8 11 12 13" />
        <Path d="M12 14C9.5 14 8 16 12 18" />
        {/* Right grains */}
        <Path d="M12 4C14.5 4 16 6 12 8" />
        <Path d="M12 9C14.5 9 16 11 12 13" />
        <Path d="M12 14C14.5 14 16 16 12 18" />
      </G>
    </Svg>
  );
}
