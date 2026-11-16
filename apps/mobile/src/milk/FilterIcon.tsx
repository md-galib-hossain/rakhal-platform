import Svg, { Circle, Path } from 'react-native-svg';

export interface FilterIconProps {
  size?: number;
  color?: string;
}

/**
 * Filter icon (modern sliders symbol, matching mockup [ 🎚️ ]).
 */
export function FilterIcon({ size = 20, color = 'currentColor' }: FilterIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 21V14" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 10V3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 21V12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 8V3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 21V16" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 12V3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="4" cy="12" r="2" stroke={color} strokeWidth={2} fill="none" />
      <Circle cx="12" cy="10" r="2" stroke={color} strokeWidth={2} fill="none" />
      <Circle cx="20" cy="14" r="2" stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}
