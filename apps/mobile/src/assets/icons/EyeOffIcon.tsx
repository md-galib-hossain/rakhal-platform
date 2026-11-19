import Svg, { Path, G } from 'react-native-svg';
import type { IconProps } from './types.ts';

/**
 * Eye-off icon: 24x24 2dp stroke geometry for password hide.
 */
export function EyeOffIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <Path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <Path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <Path d="M2 2l20 20" />
      </G>
    </Svg>
  );
}
