import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIST_ROW_METRICS,
  LIST_ROW_SURFACE,
  listRowColors,
  listRowMinHeight,
  listRowStacksTrailing,
  showsChevron,
} from '../src/components/display/list-row-style.ts';
import { STACK_AT_FONT_SCALE } from '../src/components/internal/layout-rules.ts';
import { contrastPairs, touchTarget, type AnyColorName } from '../src/theme/tokens.ts';

const isListed = (fg: AnyColorName, bg: AnyColorName) => contrastPairs.some((p) => p.fg === fg && p.bg === bg);

test('metrics match the spec: 56 / 64 minimum, 12 padding, 8 vertical, 12 gap, 4 stripe', () => {
  assert.equal(LIST_ROW_METRICS.minHeightOneLine, 56);
  assert.equal(LIST_ROW_METRICS.minHeightTwoLine, 64);
  assert.equal(LIST_ROW_METRICS.paddingHorizontal, 12);
  assert.equal(LIST_ROW_METRICS.paddingVertical, 8);
  assert.equal(LIST_ROW_METRICS.gap, 12);
  assert.equal(LIST_ROW_METRICS.stripe, 4);
  assert.equal(LIST_ROW_METRICS.dividerInset, 12);
});

test('minimum height depends on the subtitle and never drops below the 48dp target', () => {
  assert.equal(listRowMinHeight(false), 56);
  assert.equal(listRowMinHeight(true), 64);
  assert.ok(listRowMinHeight(false) >= touchTarget.min);
});

test('colours: enabled title is foreground, disabled is mutedForeground; subtitle always mutedForeground', () => {
  assert.equal(listRowColors(false).title, 'foreground');
  assert.equal(listRowColors(true).title, 'mutedForeground');
  assert.equal(listRowColors(false).subtitle, 'mutedForeground');
  assert.equal(listRowColors(true).subtitle, 'mutedForeground');
});

test('selected stripe is the standalone primaryEdge; check is primaryText; divider is the decorative border', () => {
  const c = listRowColors(false);
  assert.equal(c.stripe, 'primaryEdge');
  assert.equal(c.check, 'primaryText');
  assert.equal(c.divider, 'border');
});

test('every text/mark pair on the card surface is in contrastPairs', () => {
  assert.equal(LIST_ROW_SURFACE, 'card');
  for (const disabled of [false, true]) {
    const c = listRowColors(disabled);
    assert.ok(isListed(c.title, 'card'), `${c.title} on card`);
    assert.ok(isListed(c.subtitle, 'card'), `${c.subtitle} on card`);
    assert.ok(isListed(c.chevron, 'card'), `${c.chevron} on card`);
    assert.ok(isListed(c.check, 'card'), `${c.check} on card`);
  }
  assert.ok(isListed('primaryEdge', 'card'));
});

test('chevron: only when pressable, off when showChevron === false', () => {
  assert.equal(showsChevron(true, undefined), true);
  assert.equal(showsChevron(true, true), true);
  assert.equal(showsChevron(true, false), false);
  assert.equal(showsChevron(false, undefined), false);
  assert.equal(showsChevron(false, true), false);
});

test('trailing stacks only above STACK_AT_FONT_SCALE and only when there is trailing content', () => {
  assert.equal(listRowStacksTrailing(1, true), false);
  assert.equal(listRowStacksTrailing(STACK_AT_FONT_SCALE, true), false);
  assert.equal(listRowStacksTrailing(1.31, true), true);
  assert.equal(listRowStacksTrailing(2, true), true);
  assert.equal(listRowStacksTrailing(2, false), false);
  assert.equal(listRowStacksTrailing(Number.NaN, true), false);
});
