import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HERD_STATES, STATUS_TONES, statusStyle, type StatusSpec } from '../src/components/display/status-style.ts';
import { textOnTint, contrastPairs, TINT_NAMES, type AnyColorName, type TintName } from '../src/theme/tokens.ts';

const all: StatusSpec[] = [...STATUS_TONES.map((tone) => ({ tone })), ...HERD_STATES.map((herdState) => ({ herdState }))];
const find = (fg: AnyColorName, bg: AnyColorName) => contrastPairs.find((p) => p.fg === fg && p.bg === bg);
const isTint = (n: AnyColorName): n is TintName => (TINT_NAMES as readonly string[]).includes(n);

test('5 tones and 6 herd states are covered', () => {
  assert.equal(STATUS_TONES.length, 5);
  assert.equal(HERD_STATES.length, 6);
});

test('tone marks match the spec', () => {
  assert.deepEqual(statusStyle({ tone: 'success' }), { fill: 'successTint', markGlyph: 'check', markColor: 'primaryText' });
  assert.deepEqual(statusStyle({ tone: 'warning' }), { fill: 'warningTint', markGlyph: 'exclamation', markColor: 'warningText' });
  assert.deepEqual(statusStyle({ tone: 'destructive' }), { fill: 'destructiveTint', markGlyph: 'exclamation', markColor: 'destructiveText' });
  assert.deepEqual(statusStyle({ tone: 'info' }), { fill: 'infoTint', markGlyph: 'info', markColor: 'infoText' });
  assert.deepEqual(statusStyle({ tone: 'neutral' }), { fill: 'muted', border: 'border', markGlyph: 'dot', markColor: 'mutedForeground' });
});

test('herd states are word + dot: state<X>Bar dot on state<X>Tint, no border', () => {
  for (const s of HERD_STATES) {
    const cap = s[0]!.toUpperCase() + s.slice(1);
    assert.deepEqual(statusStyle({ herdState: s }), {
      fill: `state${cap}Tint`,
      markGlyph: 'dot',
      markColor: `state${cap}Bar`,
    });
  }
});

test('only neutral draws a border', () => {
  for (const spec of all) assert.equal('border' in statusStyle(spec), 'tone' in spec && spec.tone === 'neutral');
});

test('tone marks are check / exclamation / info / dot; herd marks are always dot', () => {
  for (const spec of all) {
    const { markGlyph } = statusStyle(spec);
    assert.ok(['check', 'exclamation', 'info', 'dot'].includes(markGlyph));
    if ('herdState' in spec) assert.equal(markGlyph, 'dot');
  }
});

test('every markColor x fill pair is in contrastPairs: text pairs for tone glyphs, ui pairs for herd dots', () => {
  const problems: string[] = [];
  for (const spec of all) {
    const { fill, markColor } = statusStyle(spec);
    const pair = find(markColor, fill);
    if (!pair) problems.push(`${markColor} on ${fill} not listed`);
    else if ('herdState' in spec && pair.kind === 'text') problems.push(`${markColor} on ${fill} should be ui/label-only`);
  }
  assert.deepEqual(problems, []);
});

test('the label is foreground on the fill: that text pair is listed (textOnTint for tints)', () => {
  for (const spec of all) {
    const { fill } = statusStyle(spec);
    const pair = find('foreground', fill);
    assert.ok(pair && pair.kind === 'text', `foreground on ${fill}`);
    if (isTint(fill)) assert.equal(textOnTint(fill), 'foreground');
  }
});

test('mutedForeground is never used on a tint fill', () => {
  for (const spec of all) {
    const { fill, markColor } = statusStyle(spec);
    if (isTint(fill)) assert.notEqual(markColor, 'mutedForeground');
  }
});
