import { Image, type ImageSourcePropType } from 'react-native';
import type { IconProps } from './types.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const milkSource = require('./milk.png') as ImageSourcePropType;

/**
 * Milk icon rendered from brand asset (milk.png).
 */
export function MilkIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Image
      source={milkSource}
      style={{
        width: size,
        height: size,
        tintColor: color === 'currentColor' ? undefined : color,
      }}
      resizeMode="contain"
    />
  );
}
