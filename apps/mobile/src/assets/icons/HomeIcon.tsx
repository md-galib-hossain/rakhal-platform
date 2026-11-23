import { Image, type ImageSourcePropType } from 'react-native';
import type { IconProps } from './types.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const homeSource = require('./home.png') as ImageSourcePropType;

/**
 * Home icon rendered from brand asset (home.png).
 */
export function HomeIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Image
      source={homeSource}
      style={{
        width: size,
        height: size,
        tintColor: color === 'currentColor' ? undefined : color,
      }}
      resizeMode="contain"
    />
  );
}
