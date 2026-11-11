import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUTTON_METRICS,
  buttonColors,
  defaultButtonSize,
  GHOST_SURFACES,
  type ButtonVariant,
} from '../src/components/actions/button-style.ts';
import { PRESSED_OVERLAY, pressedFillName } from '../src/components/internal/press-overlay.ts';
import { blend, contrastRatio, THRESHOLD_TEXT, THRESHOLD_UI } from '../scripts/lib/contrast.ts';
import { allColors, contrastPairs, touchTarget, type AnyColorName } from '../src/theme/tokens.ts';

const VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'destructive', 'ghost'];
const THEMES = ['light', 'dark'] as const;

test('metrics: md = 48 / 16 / 10, lg = 56 / 20 / 12 (spec 2.1)', () => {
  assert.deepEqual(BUTTON_METRICS.md, { minHeight: 48, paddingHorizontal: 16, paddingVertical: 10 });
  assert.deepEqual(BUTTON_METRICS.lg, { minHeight: 56, paddingHorizontal: 20, paddingVertical: 12 });
  assert.equal(BUTTON_METRICS.md.minHeight, touchTarget.min);
  assert.equal(BUTTON_METRICS.lg.minHeight, touchTarget.primary);
});

test('default size: primary lg, everything else md', () => {
  assert.equal(defaultButtonSize('primary'), 'lg');
  for (const v of ['secondary', 'destructive', 'ghost'] as const) assert.equal(defaultButtonSize(v), 'md');
});

test('variant colour table matches the spec', () => {
  assert.deepEqual(buttonColors('primary', false), { fill: 'primary', label: 'primaryForeground', border: 'primary' });
  assert.deepEqual(buttonColors('secondary', false), { fill: 'secondary', label: 'secondaryForeground', border: 'inputBorder' });
  assert.deepEqual(buttonColors('destructive', false), { fill: 'destructive', label: 'destructiveForeground', border: 'destructive' });
  assert.deepEqual(buttonColors('ghost', false), { fill: 'transparent', label: 'foreground', border: 'transparent' });
});

test('disabled is muted / mutedForeground / border for every variant', () => {
  for (const v of VARIANTS) assert.deepEqual(buttonColors(v, true), { fill: 'muted', label: 'mutedForeground', border: 'border' });
});

const isListed = (fg: AnyColorName, bg: AnyColorName) => contrastPairs.some((p) => p.fg === fg && p.bg === bg);

test('every (label, fill) pair a variant uses is in contrastPairs (disabled included: exempt but listed)', () => {
  const missing: string[] = [];
  for (const v of VARIANTS) {
    for (const disabled of [false, true]) {
      const { fill, label } = buttonColors(v, disabled);
      const fills: readonly AnyColorName[] = fill === 'transparent' ? GHOST_SURFACES : [fill];
      for (const f of fills) if (!isListed(label, f)) missing.push(`${v}${disabled ? ' (disabled)' : ''}: ${label} on ${f}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('the inputBorder outline of secondary is a listed >= 3:1 ui pair on card and background', () => {
  for (const bg of ['card', 'background'] as const) {
    assert.ok(contrastPairs.some((p) => p.fg === 'inputBorder' && p.bg === bg && p.kind === 'ui'), bg);
    for (const theme of THEMES) assert.ok(contrastRatio(allColors[theme].inputBorder, allColors[theme][bg]) >= THRESHOLD_UI, `${theme} ${bg}`);
  }
});

test('resting label contrast >= 4.5 per variant and theme (ghost on every surface)', () => {
  const failures: string[] = [];
  for (const theme of THEMES) {
    const c = allColors[theme];
    for (const v of VARIANTS) {
      const { fill, label } = buttonColors(v, false);
      const fills: readonly AnyColorName[] = fill === 'transparent' ? GHOST_SURFACES : [fill];
      for (const f of fills) {
        const ratio = contrastRatio(c[label], c[f]);
        if (ratio < THRESHOLD_TEXT) failures.push(`${theme} ${v}: ${label} on ${f} = ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('pressed label contrast >= 4.5 per variant and theme (primary on primaryHover, others on the 12% overlay blend)', () => {
  const failures: string[] = [];
  for (const theme of THEMES) {
    const c = allColors[theme];
    for (const v of VARIANTS) {
      const { fill, label } = buttonColors(v, false);
      const pressedFill = pressedFillName(v);
      const surfaces: readonly AnyColorName[] = fill === 'transparent' ? GHOST_SURFACES : [fill];
      for (const s of surfaces) {
        const pressed = pressedFill ? c[pressedFill] : blend(c[PRESSED_OVERLAY.token], c[s], PRESSED_OVERLAY.opacity);
        const ratio = contrastRatio(c[label], pressed);
        if (ratio < THRESHOLD_TEXT) failures.push(`${theme} ${v} pressed on ${s}: ${label} = ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('only primary swaps fill when pressed; its pair is the listed primaryForeground on primaryHover', () => {
  assert.equal(pressedFillName('primary'), 'primaryHover');
  assert.ok(isListed('primaryForeground', 'primaryHover'));
});
