/**
 * Pure layout rules shared by WP3 components (spec 1.1 and 1.4). No React Native imports: node --test imports this file.
 */
import { touchTarget } from '../../theme/tokens.ts';

/** Above this system font scale, StepperField and ListRow stack instead of sitting in one row. */
export const STACK_AT_FONT_SCALE = 1.3;

/** A TextField/StepperField unit suffix drops under the value when it would take more than this share of the width. */
export const UNIT_DROP_FRACTION = 0.4;

/** True when layouts should stack. Bad input (NaN, <= 0) never stacks. */
export function shouldStack(fontScale: number): boolean {
  return fontScale > STACK_AT_FONT_SCALE; // NaN and non-positive compare false
}

export interface UnitDropInput {
  fontScale: number;
  unitWidth: number;
  containerWidth: number;
}

/** Unit stays inline unless the text is scaled AND the measured unit is wider than 40% of the container. */
export function shouldDropUnit({ fontScale, unitWidth, containerWidth }: UnitDropInput): boolean {
  if (!shouldStack(fontScale) || !(containerWidth > 0)) return false;
  return unitWidth > containerWidth * UNIT_DROP_FRACTION;
}

export type TargetSize = 'md' | 'lg';

/** Component size name -> minimum touch target (dp). md = touchTarget.min (48), lg = touchTarget.primary (56). */
export function targetSize(size: TargetSize): number {
  return size === 'lg' ? touchTarget.primary : touchTarget.min;
}
