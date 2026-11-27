import { Image, type ImageSourcePropType } from 'react-native';
import type { IconProps } from './types.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const aqrSource = require('./aqr-gauge.png') as ImageSourcePropType;

/**
 * AQR Gauge / Speedometer rating icon rendered from brand asset (aqr-gauge.png).
 */
export function AqrGaugeIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Image
      source={aqrSource}
      style={{
        width: size,
        height: size,
        tintColor: color === 'currentColor' ? undefined : color,
      }}
      resizeMode="contain"
    />
  );
}
