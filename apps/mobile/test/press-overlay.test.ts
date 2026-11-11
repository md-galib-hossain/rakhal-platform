import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESSED_OVERLAY, pressedFillName, pressedOverlayStyle } from '../src/components/internal/press-overlay.ts';
import { blend, contrastRatio, THRESHOLD_TEXT } from '../scripts/lib/contrast.ts';
import { allColors, type AnyColorName } from '../src/theme/tokens.ts';

test('overlay is foreground at 12% (spec C3)', () => {
  assert.deepEqual(PRESSED_OVERLAY, { token: 'foreground', opacity: 0.12 });
});

test('pressedOverlayStyle resolves the token per theme and keeps opacity separate', () => {
  for (const theme of ['light', 'dark'] as const) {
    const s = pressedOverlayStyle(allColors[theme]);
    assert.equal(s.backgroundColor, allColors[theme].foreground);
    assert.equal(s.opacity, 0.12);
  }
});

test('primary pressed uses the primaryHover token, everything else the overlay', () => {
  assert.equal(pressedFillName('primary'), 'primaryHover');
  assert.equal(pressedFillName('secondary'), null);
  assert.equal(pressedFillName('destructive'), null);
  assert.equal(pressedFillName('ghost'), null);
});

// label token, fills the overlay can sit on. Mirrors the Button table (spec 2.1), ListRow (2.8) and unselected Chip (2.5).
const CASES: ReadonlyArray<readonly [AnyColorName, readonly AnyColorName[]]> = [
  ['secondaryForeground', ['secondary']],
  ['destructiveForeground', ['destructive']],
  ['foreground', ['background', 'card', 'muted', 'popover']],
];

test('12% foreground blended over each overlay surface keeps label contrast >= 4.5 in both themes', () => {
  const failures: string[] = [];
  for (const theme of ['light', 'dark'] as const) {
    const c = allColors[theme];
    for (const [label, fills] of CASES) {
      for (const fill of fills) {
        const pressed = blend(c[PRESSED_OVERLAY.token], c[fill], PRESSED_OVERLAY.opacity);
        const ratio = contrastRatio(c[label], pressed);
        if (ratio < THRESHOLD_TEXT) failures.push(`${theme}: ${label} on pressed ${fill} = ${ratio.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('primary pressed: primaryForeground on primaryHover >= 4.5 in both themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    const c = allColors[theme];
    assert.ok(contrastRatio(c.primaryForeground, c[pressedFillName('primary')!]) >= THRESHOLD_TEXT, theme);
  }
});
