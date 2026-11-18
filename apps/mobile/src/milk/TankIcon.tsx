import Svg, { Ellipse, Path } from 'react-native-svg';

export interface TankIconProps {
  size?: number;
  color?: string;
}

/**
 * Bulk milk storage tank / cooler vat icon (Lucide cylinder style).
 * 24x24 2dp stroke geometry representing a farm milk container.
 */
export function TankIcon({ size = 14, color = 'currentColor' }: TankIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Top rim of storage tank */}
      <Ellipse cx="12" cy="5" rx="8" ry="2.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Tank body and rounded bottom */}
      <Path
        d="M4 5V19C4 20.38 7.58 21.5 12 21.5C16.42 21.5 20 20.38 20 19V5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Fill level line indicator */}
      <Path
        d="M4 12C4 13.38 7.58 14.5 12 14.5C16.42 14.5 20 13.38 20 12"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
