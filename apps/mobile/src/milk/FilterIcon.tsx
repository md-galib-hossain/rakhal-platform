import Svg, { Path } from 'react-native-svg';

export interface FilterIconProps {
  size?: number;
  color?: string;
}

/**
 * Filter icon (funnel symbol, consistent across Animals and Milk pages).
 */
export function FilterIcon({ size = 18, color = 'currentColor' }: FilterIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
