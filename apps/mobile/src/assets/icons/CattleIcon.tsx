import { Image, type ImageSourcePropType } from 'react-native';
import type { IconProps } from './types.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const farmSource = require('./farm.png') as ImageSourcePropType;

/**
 * Animal / Farm icon rendered from brand asset (farm.png).
 */
export function CattleIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Image
      source={farmSource}
      style={{
        width: size,
        height: size,
        tintColor: color === 'currentColor' ? undefined : color,
      }}
      resizeMode="contain"
    />
  );
}
