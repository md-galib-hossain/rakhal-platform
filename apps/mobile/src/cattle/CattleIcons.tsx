import Svg, { Circle, Line, Path } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color?: string;
}

export function UsersIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function AwardIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HeartPulseIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h4.28" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function DropletsIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CalendarIcon({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ScaleIcon({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v18M19 8l-7-3-7 3M19 8l3 7H16l3-7zM5 8l3 7H2l3-7zM9 21h6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function MapPinIcon({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="10" r="3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ClockIcon({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 6v6l4 2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function VenusIcon({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="9" r="6" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="15" x2="12" y2="22" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="9" y1="18" x2="15" y2="18" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MarsIcon({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="10" cy="14" r="6" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="14.5" y1="9.5" x2="21" y2="3" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="15" y1="3" x2="21" y2="3" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="21" y1="3" x2="21" y2="9" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SearchIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 20L16.5 16.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronDownIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronUpIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 15l-6-6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CheckCircleIcon({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SyringeIcon({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m18 2 4 4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="m17 7 3-3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="m9 11 4 4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="m5 19-3 3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="m14 4 6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function StethoscopeIcon({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="20" cy="10" r="2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ClipboardCheckIcon({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 14l2 2 4-4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BabyIcon({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 12h.01M15 12h.01" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MilkIcon({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 2h8M9 2v3h6V2M6 8h12a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 13h12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ShieldCheckIcon({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="m9 12 2 2 4-4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CalendarClockIcon({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="16" cy="16" r="6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 14v2l1 1" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function WarehouseIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35a2 2 0 0 1 .84-1.63l8-5.71a2 2 0 0 1 2.32 0l8 5.71a2 2 0 0 1 .84 1.63z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 18h12V11a3 3 0 0 0-3-3H9a3 3 0 0 0-3 3v7z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 8v10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function UserPlusIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="8.5" cy="7" r="4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="20" y1="8" x2="20" y2="14" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="23" y1="11" x2="17" y2="11" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function Trash2Icon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="10" y1="11" x2="10" y2="17" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="14" y1="11" x2="14" y2="17" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CalendarPlusIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="14" x2="12" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="10" y1="16" x2="14" y2="16" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function FilterIcon({ size = 16, color = 'currentColor' }: IconProps) {
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

export function PlusIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function LayersIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m12 2 10 5-10 5L2 7l10-5zm0 10 10 5-10 5-10-5 10-5z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function EventKindIcon({ kind, size = 14, color }: { kind: string; size?: number; color?: string }) {
  switch (kind) {
    case 'HEALTH_STEP':
      return <StethoscopeIcon size={size} color={color} />;
    case 'PREVENTIVE_STEP':
    case 'VACCINATION':
    case 'DEWORMING':
      return <SyringeIcon size={size} color={color} />;
    case 'PREGNANCY_CHECK':
      return <ClipboardCheckIcon size={size} color={color} />;
    case 'CALVING':
      return <BabyIcon size={size} color={color} />;
    case 'DRY_OFF':
      return <MilkIcon size={size} color={color} />;
    case 'WITHDRAWAL_END':
      return <ShieldCheckIcon size={size} color={color} />;
    case 'WEANING':
      return <CalendarClockIcon size={size} color={color} />;
    case 'TASK':
    default:
      return <ClipboardCheckIcon size={size} color={color} />;
  }
}

export function BellIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MoreVerticalIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="1.5" fill={color} />
      <Circle cx="12" cy="5" r="1.5" fill={color} />
      <Circle cx="12" cy="19" r="1.5" fill={color} />
    </Svg>
  );
}

export function PencilIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function WalletIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 7v13a2 2 0 0 0 2 2h16v-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 12h5v4h-5z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function DnaIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 15c6.667-6 13.333 0 20-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="m17 6-2.5-2.5M14 8l-4-4M7 18l2.5 2.5M10 16l4 4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="m20 9 .5.5M4 15l-.5-.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function WheatIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 22 16 8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function TrendingUpIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m22 7-8.5 8.5-5-5L2 17" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 7h6v6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronLeftIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m15 18-6-6 6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m9 18 6-6-6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ArrowLeftIcon({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 12H5M12 19l-7-7 7-7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SparklesIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function FileTextIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ZoomInIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="11" y1="8" x2="11" y2="14" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="8" y1="11" x2="14" y2="11" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ZoomOutIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="8" y1="11" x2="14" y2="11" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function RotateCcwIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 3v5h5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function Maximize2Icon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CowIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 4c0 3 2 5 4 5M19 4c0 3-2 5-4 5M7 9h10c1.5 0 2.5 1 2.5 3v4c0 2-1.5 3.5-3.5 3.5h-8C6 19.5 4.5 18 4.5 16v-4c0-2 1-3 2.5-3z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="9" cy="14" r="1" fill={color} />
      <Circle cx="15" cy="14" r="1" fill={color} />
    </Svg>
  );
}

export function ArrowRightIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M12 5l7 7-7 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BarChartIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20V10M18 20V4M6 20v-4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Solid Trend Chart Icon for KPI stats (AQR performance).
 */
export function SolidTrendChartIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* 3 solid rounded bars */}
      <Path
        d="M4 19h2.5a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1Zm7 0h2.5a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1Zm7 0h2.5a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H18a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1Z"
        fill={color}
      />
      {/* Upward trend pointer arrow */}
      <Path
        d="M3.7 10.7a1 1 0 0 1 0-1.4l5.3-5.3a1 1 0 0 1 1.4 0l3.3 3.3 5.3-5.3H16a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V3.4l-5.6 5.6a1 1 0 0 1-1.4 0l-3.3-3.3-4.6 4.6a1 1 0 0 1-1.4 0Z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * Solid Breeding / Pedigree Icon matching user's reference image:
 * Pedigree tree with 2 parent cows at the top, a T-bar connector,
 * and an offspring calf at the bottom with radiant sparks.
 */
export function BreedingPedigreeIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* T-bar connector between parents and down to calf */}
      <Path
        d="M36 32h28v4H52v16h-4V36H36v-4Z"
        fill={color}
      />

      {/* --- Left Parent Cow --- */}
      {/* Horns & Ears & Head Base with eye cutouts and muzzle cutout in evenodd fill */}
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17 11l4 6h10l4-6 5 7c4-1 9 1 9 4s-4 4-7 4c-1 3-3 8-6 10-2 2-5 3-8 3s-6-1-8-3c-3-2-5-7-6-10-3 0-7-1-7-4s5-5 9-4l5-7Zm6 13a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm8 0a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm-4 13c-4.4 0-8 2.7-8 6s3.6 6 8 6 8-2.7 8-6-3.6-6-8-6Z"
        fill={color}
      />
      {/* Left cow nostrils inside muzzle */}
      <Circle cx="24" cy="43" r="1.6" fill={color} />
      <Circle cx="30" cy="43" r="1.6" fill={color} />

      {/* --- Right Parent Cow --- */}
      {/* Horns & Ears & Head Base with eye cutouts and muzzle cutout in evenodd fill */}
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M63 11l4 6h10l4-6 5 7c4-1 9 1 9 4s-4 4-7 4c-1 3-3 8-6 10-2 2-5 3-8 3s-6-1-8-3c-3-2-5-7-6-10-3 0-7-1-7-4s5-5 9-4l5-7Zm6 13a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm8 0a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm-4 13c-4.4 0-8 2.7-8 6s3.6 6 8 6 8-2.7 8-6-3.6-6-8-6Z"
        fill={color}
      />
      {/* Right cow nostrils inside muzzle */}
      <Circle cx="70" cy="43" r="1.6" fill={color} />
      <Circle cx="76" cy="43" r="1.6" fill={color} />

      {/* --- Bottom Calf / Offspring --- */}
      {/* Horns & Ears & Head Base with eye cutouts and muzzle cutout */}
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M43 50l3 4.5h8l3-4.5 4 5.5c3-.8 7 .8 7 3s-3 3-5.5 3c-.8 2.5-2.2 6-4.5 7.5-1.5 1.5-3.5 2-5 2s-3.5-.5-5-2c-2.3-1.5-3.7-5-4.5-7.5-2.5 0-5.5-.8-5.5-3s4-3.8 7-3l4-5.5Zm4 9.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Zm6 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Zm-3 10c-3.3 0-6 2-6 4.5s2.7 4.5 6 4.5 6-2 6-4.5-2.7-4.5-6-4.5Z"
        fill={color}
      />
      {/* Calf nostrils inside muzzle */}
      <Circle cx="47.5" cy="74" r="1.2" fill={color} />
      <Circle cx="52.5" cy="74" r="1.2" fill={color} />

      {/* Radiant sparks around calf */}
      <Path
        d="M32 71h5a1.5 1.5 0 0 0 0-3h-5a1.5 1.5 0 0 0 0 3ZM63 71h5a1.5 1.5 0 0 0 0-3h-5a1.5 1.5 0 0 0 0 3ZM35.5 83.5l4-2.5a1.5 1.5 0 0 0-1.6-2.5l-4 2.5a1.5 1.5 0 1 0 1.6 2.5ZM60.5 81l4 2.5a1.5 1.5 0 0 0 1.6-2.5l-4-2.5a1.5 1.5 0 0 0-1.6 2.5ZM50 85a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 3 0v-5A1.5 1.5 0 0 0 50 85Z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * Solid Milk Droplets Icon (filled milk drops for KPI stats).
 */
export function SolidDropletsIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Main big milk drop - filled */}
      <Path
        d="M14.5 2.5c-.3-.5-1-.7-1.4-.3-.2.1-.3.3-.4.5-1.8 3.3-4.7 7-4.7 10.3 0 3.9 3.1 7 7 7s7-3.1 7-7c0-3.3-2.9-7-4.7-10.3-.2-.2-.5-.4-.8-.2Z"
        fill={color}
      />
      {/* Smaller foreground droplet - filled */}
      <Path
        d="M6.2 9.5c-.3-.4-.8-.5-1.2-.2-.2.1-.3.2-.3.4-1.3 2.5-3.2 5.2-3.2 7.8 0 3 2.3 5.5 5.2 5.5s5.2-2.5 5.2-5.5c0-2.6-1.9-5.3-3.2-7.8-.1-.1-.3-.2-.5-.1l-2 .2Z"
        fill={color}
        opacity={0.85}
      />
    </Svg>
  );
}







