import { Image, type ImageSourcePropType } from 'react-native';
import type { IconProps } from './types.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const clipboardSource = require('./clipboard.png') as ImageSourcePropType;

/**
 * Tasks icon rendered from brand asset (clipboard.png).
 */
export function TasksIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Image
      source={clipboardSource}
      style={{
        width: size,
        height: size,
        tintColor: color === 'currentColor' ? undefined : color,
      }}
      resizeMode="contain"
    />
  );
}
