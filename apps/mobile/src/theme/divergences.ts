/**
 * Registry of DELIBERATE differences between mobile light-theme tokens and the web source of truth
 * (rakhal-consumer-frontend/app/globals.css, read-only). Owner decision 2026-11-11: fix the failing
 * light-theme WCAG pairs in mobile only; leave web untouched.
 *
 * check-token-drift passes for a drifting token ONLY if it is listed here AND both the web value and
 * the mobile value equal the recorded ones. Anything else (unlisted drift, a listed token whose mobile
 * value changed, a web value that changed, an entry with no drift left) fails.
 *
 * Allowed to contain hex literals (with tokens.ts), enforced by test/boundary.test.ts.
 * Ratios are WCAG 2.x contrast of `pair` (fg on bg), before = web value, after = mobile value.
 */
import type { ColorName } from './tokens.ts';

export interface Divergence {
  theme: 'light' | 'dark';
  token: ColorName;
  webHex: string;
  mobileHex: string;
  /** The contrast pair this fix is for (must be a pair in contrastPairs). */
  pair: { fg: ColorName; bg: ColorName };
  ratioBefore: number;
  ratioAfter: number;
  reason: string;
}

export const divergences: readonly Divergence[] = [
  {
    theme: 'light',
    token: 'primaryHover',
    webHex: '#00774c',
    mobileHex: '#009760',
    pair: { fg: 'primaryForeground', bg: 'primaryHover' },
    ratioBefore: 3.03,
    ratioAfter: 4.53,
    reason:
      'Label on the pressed state is dark (owner decision), so the pressed fill must be lighter, not darker. #009760 stays a slightly darker green than primary #00a86b.',
  },
  {
    theme: 'light',
    token: 'success',
    webHex: '#16a34a',
    mobileHex: '#12883e',
    pair: { fg: 'successForeground', bg: 'success' },
    ratioBefore: 3.3,
    ratioAfter: 4.55,
    reason: 'White label on the success fill needs 4.5:1; darkened the fill at constant hue. chart1 keeps the web value.',
  },
  {
    theme: 'light',
    token: 'warningForeground',
    webHex: '#ffffff',
    mobileHex: '#171d22',
    pair: { fg: 'warningForeground', bg: 'warning' },
    ratioBefore: 2.15,
    ratioAfter: 7.92,
    reason:
      'Amber cannot reach 4.5:1 with a white label without turning brown; label switched to the dark foreground colour, amber fill unchanged.',
  },
  {
    theme: 'light',
    token: 'destructive',
    webHex: '#ef4444',
    mobileHex: '#eb1616',
    pair: { fg: 'destructiveForeground', bg: 'destructive' },
    ratioBefore: 3.76,
    ratioAfter: 4.51,
    reason: 'White label on the destructive fill needs 4.5:1; darkened the fill at constant hue. chart2 keeps the web value.',
  },
  {
    theme: 'light',
    token: 'info',
    webHex: '#3b82f6',
    mobileHex: '#1e6ff5',
    pair: { fg: 'infoForeground', bg: 'info' },
    ratioBefore: 3.68,
    ratioAfter: 4.52,
    reason: 'White label on the info fill needs 4.5:1; darkened the fill at constant hue. chart3 keeps the web value.',
  },
];
