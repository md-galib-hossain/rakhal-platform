import Svg, { Path } from 'react-native-svg';

export interface DropletIconProps {
  size?: number;
  color?: string;
}

export function DropletIcon({ size = 16, color = 'currentColor' }: DropletIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
