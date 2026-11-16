import Svg, { Path, G } from 'react-native-svg';
import type { IconProps } from './types.ts';

/**
 * Milk icon (D9 Flaticon): milk bottle with cap and milk drop badge.
 */
export function MilkIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {/* Cap */}
        <Path d="M9 2H15V4H9V2Z" />
        {/* Bottle neck & body */}
        <Path d="M10 4V6.5L7.5 9.5V20C7.5 21.1 8.4 22 9.5 22H14.5C15.6 22 16.5 21.1 16.5 20V9.5L14 6.5V4" />
        {/* Milk level / drop in center */}
        <Path d="M12 12C11 13.2 10.5 14.2 10.5 15.2C10.5 16.2 11.2 17 12 17C12.8 17 13.5 16.2 13.5 15.2C13.5 14.2 13 13.2 12 12Z" />
      </G>
    </Svg>
  );
}
