import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { expectNoFixedTextHeight, findNodes, flatStyle } from '../../test-utils/touch-target.ts';
import { allColors, fontFamily, radius } from '../../theme/tokens.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { HERD_STATES, STATUS_TONES, statusStyle } from './status-style.ts';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const HIDDEN = { includeHiddenElements: true } as const;
const badge = () => screen.getByTestId('s');

describe('StatusBadge', () => {
  it.each(['light', 'dark'] as const)('every tone renders word + mark with the tint fill and foreground label (%s)', async (scheme) => {
    const c = allColors[scheme];
    for (const tone of STATUS_TONES) {
      const look = statusStyle({ tone });
      const view = await mount(<StatusBadge testID="s" tone={tone} label={`Label ${tone}`} />, { scheme });
      expect(screen.getByText(`Label ${tone}`)).toBeTruthy();
      expect(flatStyle(screen.getByText(`Label ${tone}`)).color).toBe(c.foreground);
      expect(flatStyle(badge()).backgroundColor).toBe(c[look.fill]);
      expect(screen.getByTestId(`glyph-${look.markGlyph}`, HIDDEN)).toBeTruthy();
      if (look.border) expect(flatStyle(badge())).toMatchObject({ borderWidth: 1, borderColor: c[look.border] });
      else expect(flatStyle(badge()).borderWidth).toBeUndefined();
      view.unmount();
    }
  });

  it.each(['light', 'dark'] as const)('every herd state renders word + dot on its tint (%s)', async (scheme) => {
    const c = allColors[scheme];
    for (const herdState of HERD_STATES) {
      const look = statusStyle({ herdState });
      const view = await mount(<StatusBadge testID="s" herdState={herdState} label={`State ${herdState}`} />, { scheme });
      expect(screen.getByText(`State ${herdState}`)).toBeTruthy();
      expect(flatStyle(screen.getByText(`State ${herdState}`)).color).toBe(c.foreground);
      expect(flatStyle(badge()).backgroundColor).toBe(c[look.fill]);
      expect(screen.getByTestId('glyph-dot', HIDDEN)).toBeTruthy();
      view.unmount();
    }
  });

  it('the label is never mutedForeground, including on tints', async () => {
    for (const tone of STATUS_TONES) {
      const view = await mount(<StatusBadge testID="s" tone={tone} label="Ok" />);
      expect(flatStyle(screen.getByText('Ok')).color).not.toBe(allColors.light.mutedForeground);
      view.unmount();
    }
  });

  it('is one accessible text node named by the label, mark hidden, not interactive', async () => {
    await mount(<StatusBadge testID="s" tone="warning" label="Overdue" />);
    expect(badge().props.accessible).toBe(true);
    expect(badge().props.accessibilityRole).toBe('text');
    expect(badge().props.accessibilityLabel).toBe('Overdue');
    expect(badge().props.onPress).toBeUndefined();
    expect(screen.getByTestId('glyph-exclamation', HIDDEN).props.accessibilityElementsHidden).toBe(true);
  });

  it('geometry: minHeight 28, 10/4 padding, radius.md (not a pill), flex-start', async () => {
    await mount(<StatusBadge testID="s" tone="info" label="Info" />);
    expect(flatStyle(badge())).toMatchObject({
      minHeight: 28,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.md,
      alignSelf: 'flex-start',
      flexDirection: 'row',
    });
  });

  it.each(['en', 'bn'] as const)('wraps at 200%% (%s): no numberOfLines, no fixed height, label shrinks', async (locale) => {
    const label = locale === 'bn' ? 'দুগ্ধবতী গাভী পরবর্তী পরীক্ষার অপেক্ষায় আছে' : 'Waiting for the next scheduled check';
    await mount(<StatusBadge testID="s" tone="info" label={label} />, { locale, fontScale: 2 });
    expectNoFixedTextHeight(badge());
    const text = findNodes(badge(), (n) => n.type === 'Text')[0]!;
    expect(text.props.numberOfLines).toBeUndefined();
    expect(flatStyle(text).flexShrink).toBe(1);
  });

  it('bn uses the Bengali label family; script="latin" forces Inter', async () => {
    await mount(<StatusBadge testID="s" tone="success" label="OK" />, { locale: 'bn' });
    expect(flatStyle(screen.getByText('OK')).fontFamily).toBe(fontFamily.bengali.medium);
    await mount(<StatusBadge testID="s2" tone="success" label="OK" script="latin" />, { locale: 'bn' });
    expect(screen.getAllByText('OK').some((n) => flatStyle(n).fontFamily === fontFamily.latin.medium)).toBe(true);
  });

  it('rejects giving both tone and herdState at the type level', () => {
    // @ts-expect-error a badge has either a tone or a herdState
    const both = <StatusBadge tone="success" herdState="fresh" label="x" />;
    // @ts-expect-error one of tone / herdState is required
    const neither = <StatusBadge label="x" />;
    expect([both, neither]).toHaveLength(2);
  });
});
