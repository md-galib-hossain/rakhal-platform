import Svg, { Circle, Path } from 'react-native-svg';

export interface MilkIconsProps {
  size?: number;
  color?: string;
}

export function BellIcon({ size = 20, color = 'currentColor' }: MilkIconsProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BarChartIcon({ size = 18, color = 'currentColor' }: MilkIconsProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20V10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18 20V4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 20v-4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ClockIcon({ size = 14, color = 'currentColor' }: MilkIconsProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 6v6l4 2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CheckCircleIcon({ size = 16, color = 'currentColor' }: MilkIconsProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SunIcon({ size = 16, color = 'currentColor' }: MilkIconsProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="5" fill={color} />
      <Path
        d="M12 1v2.5M12 20.5V23M4.22 4.22l1.77 1.77M18.01 18.01l1.77 1.77M1 12h2.5M20.5 12H23M4.22 19.78l1.77-1.77M18.01 5.99l1.77-1.77"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SunCloudIcon({ size = 16, color = 'currentColor' }: MilkIconsProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Sun disk and rays behind */}
      <Path
        d="M9 3v2M4.05 4.93l1.41 1.41M13.95 4.93l-1.41 1.41M2 10h2M16 10h2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx="9" cy="10" r="4" fill={color} />
      {/* Solid Cloud in front */}
      <Path
        d="M18.5 20H8.5a4.5 4.5 0 0 1-.8-8.93 5.5 5.5 0 0 1 10.3 1.43A3.5 3.5 0 0 1 18.5 20z"
        fill={color}
      />
    </Svg>
  );
}

export function MoonIcon({ size = 16, color = 'currentColor' }: MilkIconsProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        fill={color}
      />
    </Svg>
  );
}
