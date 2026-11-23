import { Image, type ImageSourcePropType } from 'react-native';
import type { IconProps } from './types.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const applicationSource = require('./application.png') as ImageSourcePropType;

/**
 * More icon rendered from brand asset (application.png).
 */
export function MoreIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Image
      source={applicationSource}
      style={{
        width: size,
        height: size,
        tintColor: color === 'currentColor' ? undefined : color,
      }}
      resizeMode="contain"
    />
  );
}
