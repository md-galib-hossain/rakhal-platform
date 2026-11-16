import Svg, { Path, G } from 'react-native-svg';
import type { IconProps } from './types.ts';

/**
 * Tasks icon (D9 Flaticon): clipboard with task list check.
 */
export function TasksIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M16 4H19C20.1 4 21 4.9 21 6V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V6C3 4.9 3.9 4 5 4H8" />
        <Path d="M9 2H15V5H9V2Z" />
        <Path d="M8 12L10.5 14.5L16 9" />
        <Path d="M8 17.5H16" />
      </G>
    </Svg>
  );
}
