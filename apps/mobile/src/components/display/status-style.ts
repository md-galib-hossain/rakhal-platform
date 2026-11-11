/**
 * Pure StatusBadge resolver (spec 2.6). Token names only. Colour is never the only signal: every badge carries a
 * word (the label, always `foreground` on the fill) plus a mark: a glyph, or a dot for herd state.
 */
import type { AnyColorName } from '../../theme/tokens.ts';
import type { GlyphName } from '../internal/Glyph.tsx';

export type StatusTone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral';
export type HerdState = 'fresh' | 'insemination' | 'dry' | 'milking' | 'pregnant' | 'sick';

export const STATUS_TONES: readonly StatusTone[] = ['success', 'warning', 'destructive', 'info', 'neutral'];
export const HERD_STATES: readonly HerdState[] = ['fresh', 'insemination', 'dry', 'milking', 'pregnant', 'sick'];

export type StatusSpec = { tone: StatusTone } | { herdState: HerdState };

export interface StatusStyle {
  fill: AnyColorName;
  /** Only neutral draws a hairline (a muted fill alone barely separates from the canvas). */
  border?: AnyColorName;
  markGlyph: GlyphName;
  markColor: AnyColorName;
}

const TONES: Readonly<Record<StatusTone, StatusStyle>> = {
  success: { fill: 'successTint', markGlyph: 'check', markColor: 'primaryText' },
  warning: { fill: 'warningTint', markGlyph: 'exclamation', markColor: 'warningText' },
  destructive: { fill: 'destructiveTint', markGlyph: 'exclamation', markColor: 'destructiveText' },
  info: { fill: 'infoTint', markGlyph: 'info', markColor: 'infoText' },
  neutral: { fill: 'muted', border: 'border', markGlyph: 'dot', markColor: 'mutedForeground' },
};

const HERD: Readonly<Record<HerdState, StatusStyle>> = {
  fresh: { fill: 'stateFreshTint', markGlyph: 'dot', markColor: 'stateFreshBar' },
  insemination: { fill: 'stateInseminationTint', markGlyph: 'dot', markColor: 'stateInseminationBar' },
  dry: { fill: 'stateDryTint', markGlyph: 'dot', markColor: 'stateDryBar' },
  milking: { fill: 'stateMilkingTint', markGlyph: 'dot', markColor: 'stateMilkingBar' },
  pregnant: { fill: 'statePregnantTint', markGlyph: 'dot', markColor: 'statePregnantBar' },
  sick: { fill: 'stateSickTint', markGlyph: 'dot', markColor: 'stateSickBar' },
};

export function statusStyle(spec: StatusSpec): StatusStyle {
  return 'tone' in spec ? TONES[spec.tone] : HERD[spec.herdState];
}
