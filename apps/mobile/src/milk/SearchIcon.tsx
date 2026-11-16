import Svg, { Circle, Path } from 'react-native-svg';

export interface SearchIconProps {
  size?: number;
  color?: string;
}

/**
 * Search magnifying glass icon.
 */
export function SearchIcon({ size = 18, color = 'currentColor' }: SearchIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 20L16.5 16.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
