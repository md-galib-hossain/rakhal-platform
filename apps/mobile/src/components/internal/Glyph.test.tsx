import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { findNodes, flatStyle } from '../../test-utils/touch-target.ts';
import { allColors } from '../../theme/tokens.ts';
import { Glyph, GLYPH_NAMES, type GlyphSize } from './Glyph.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const glyph = (id: string) => screen.getByTestId(id, { includeHiddenElements: true });

describe('Glyph', () => {
  it('draws all 8 spec glyphs, each with at least one part', async () => {
    expect(GLYPH_NAMES).toHaveLength(8);
    for (const name of GLYPH_NAMES) {
      const view = await mount(<Glyph name={name} color="foreground" />);
      expect(glyph(`glyph-${name}`).children.length).toBeGreaterThan(0);
      await view.unmount();
    }
  });

  it('is a fixed square box: 20 by default, 16 and 24 allowed', async () => {
    const v = await mount(<Glyph name="plus" color="foreground" />);
    expect(flatStyle(glyph('glyph-plus'))).toMatchObject({ width: 20, height: 20 });
    await v.unmount();
    for (const size of [16, 24] as GlyphSize[]) {
      const w = await mount(<Glyph name="plus" size={size} color="foreground" />);
      expect(flatStyle(glyph('glyph-plus'))).toMatchObject({ width: size, height: size });
      await w.unmount();
    }
  });

  it('is decorative: hidden from accessibility and not a touch target', async () => {
    await mount(<Glyph name="check" color="primaryText" />);
    const props = glyph('glyph-check').props;
    expect(props.accessibilityElementsHidden).toBe(true);
    expect(props.importantForAccessibility).toBe('no-hide-descendants');
    expect(props.pointerEvents).toBe('none');
    expect(props.accessible).toBeFalsy();
  });

  it.each(['light', 'dark'] as const)('colour is a token resolved for the %s theme (no raw colour)', async (scheme) => {
    await mount(<Glyph name="plus" color="primaryText" />, { scheme });
    const parts = findNodes(glyph('glyph-plus'), (n) => n.type === 'View' && n.props.testID === undefined);
    const colours = parts.map((n) => flatStyle(n).backgroundColor);
    expect(colours.length).toBeGreaterThanOrEqual(2);
    for (const c of colours) expect(c).toBe(allColors[scheme].primaryText);
  });

  it('check and chevron are bordered (stroke 2) in the token colour, not filled', async () => {
    for (const name of ['check', 'chevronRight'] as const) {
      const v = await mount(<Glyph name={name} color="destructiveText" />);
      const [mark] = glyph(`glyph-${name}`).children as unknown as { props: { style: unknown } }[];
      const s = StyleSheet.flatten(mark!.props.style as never) as Record<string, unknown>;
      expect(s.borderColor).toBe(allColors.light.destructiveText);
      expect(s.borderRightWidth).toBe(2);
      expect(s.backgroundColor).toBeUndefined();
      await v.unmount();
    }
  });

  it('dot is 10dp in the 16dp box', async () => {
    await mount(<Glyph name="dot" size={16} color="mutedForeground" />);
    const [dot] = glyph('glyph-dot').children as unknown as { props: { style: unknown } }[];
    expect(StyleSheet.flatten(dot!.props.style as never)).toMatchObject({ width: 10, height: 10, borderRadius: 5 });
  });

  it('parts stay inside the box', async () => {
    for (const name of GLYPH_NAMES) {
      for (const size of [16, 20, 24] as GlyphSize[]) {
        const v = await mount(<Glyph name={name} size={size} color="foreground" />);
        const parts = glyph(`glyph-${name}`).children as unknown as { props: { style: unknown } }[];
        for (const p of parts) {
          const s = StyleSheet.flatten(p.props.style as never) as { left: number; top: number; width: number; height: number };
          expect(s.left).toBeGreaterThanOrEqual(-size * 0.2);
          expect(s.top).toBeGreaterThanOrEqual(-size * 0.2);
          expect(s.left + s.width).toBeLessThanOrEqual(size * 1.2);
          expect(s.top + s.height).toBeLessThanOrEqual(size * 1.2);
        }
        await v.unmount();
      }
    }
  });
});
