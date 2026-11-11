import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Dimensions, StyleSheet, useColorScheme } from 'react-native';
import type { ReactElement } from 'react';
import { LocaleProvider } from '../../providers/LocaleProvider.tsx';
import { ThemeProvider } from '../../providers/ThemeProvider.tsx';
import { memoryPrefs, PREF_KEYS } from '../../storage/prefs.ts';
import { maxFontSizeMultiplier } from '../../theme/font-scale.ts';
import { allColors, textStyle, typeScale, type TextRole } from '../../theme/tokens.ts';
import { Heading, Text } from './Text.tsx';
import { TextScaleProvider } from './TextScaleContext.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let scheme: 'light' | 'dark' = 'light';
let systemFontScale = 1;

beforeEach(() => {
  scheme = 'light';
  systemFontScale = 1;
  (useColorScheme as jest.Mock<() => unknown>).mockImplementation(() => scheme);
  const real = Dimensions.get.bind(Dimensions);
  jest.spyOn(Dimensions, 'get').mockImplementation(((dim: string) => ({
    ...real(dim as 'window'),
    fontScale: systemFontScale,
  })) as unknown as typeof Dimensions.get);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function mount(ui: ReactElement, locale: 'bn' | 'en' = 'en') {
  const storage = memoryPrefs();
  await storage.setItem(PREF_KEYS.locale, locale);
  const view = await render(
    <ThemeProvider storage={memoryPrefs()}>
      <LocaleProvider storage={storage}>{ui}</LocaleProvider>
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('t')).toBeTruthy());
  return view;
}

const flat = () => StyleSheet.flatten(screen.getByTestId('t').props.style) as Record<string, unknown>;

describe('Text font family (whole-string rule)', () => {
  it.each([
    ['en', 'Milk', 'Inter_400Regular'],
    ['en', 'দুধ', 'NotoSansBengali_400Regular'],
    ['en', '৳12,50,000', 'NotoSansBengali_400Regular'],
    ['en', 'Sold ৳450 today', 'NotoSansBengali_400Regular'],
    ['en', '1250', 'Inter_400Regular'],
    ['bn', '1250', 'NotoSansBengali_400Regular'],
    ['bn', 'Milk', 'NotoSansBengali_400Regular'],
  ] as const)('locale %s, %j -> %s', async (locale, text, family) => {
    await mount(<Text testID="t">{text}</Text>, locale);
    expect(flat().fontFamily).toBe(family);
  });

  it('explicit script override and weight select the family name', async () => {
    await mount(
      <Text testID="t" script="latin" weight="semibold">
        দুধ
      </Text>,
      'bn',
    );
    expect(flat().fontFamily).toBe('Inter_600SemiBold');
  });
});

describe('Text size and line height', () => {
  it('matches textStyle for each role in latin and bengali', async () => {
    for (const role of Object.keys(typeScale) as TextRole[]) {
      const en = await mount(<Text testID="t" role={role}>Milk</Text>, 'en');
      expect(flat()).toMatchObject(textStyle(role, 'latin'));
      await en.unmount();
      const bn = await mount(<Text testID="t" role={role}>দুধ</Text>, 'bn');
      expect(flat()).toMatchObject(textStyle(role, 'bengali'));
      await bn.unmount();
    }
  });

  it('Bangla body line height is 1.6 and Latin 1.4', async () => {
    await mount(<Text testID="t">দুধ</Text>, 'bn');
    expect(flat().lineHeight).toBe(Math.round(16 * 1.6));
    await act(async () => {});
  });

  it('has no fontWeight, no height, no default numberOfLines', async () => {
    await mount(<Text testID="t">দুধ</Text>, 'bn');
    const s = flat();
    expect(s).not.toHaveProperty('fontWeight');
    expect(s).not.toHaveProperty('height');
    expect(screen.getByTestId('t').props.numberOfLines).toBeUndefined();
  });

  it('passes style, numberOfLines and accessibility props through', async () => {
    await mount(
      <Text testID="t" style={{ marginTop: 7 }} numberOfLines={2} ellipsizeMode="middle" accessibilityLabel="lbl">
        Milk
      </Text>,
    );
    expect(flat().marginTop).toBe(7);
    expect(screen.getByTestId('t').props.numberOfLines).toBe(2);
    expect(screen.getByTestId('t').props.ellipsizeMode).toBe('middle');
    expect(screen.getByTestId('t').props.accessibilityLabel).toBe('lbl');
  });
});

describe('Text font-scale cap enforcement', () => {
  it.each([2, 3])('system mode at %sx: RN scaling on, cap passed per role', async (scale) => {
    systemFontScale = scale;
    for (const role of Object.keys(typeScale) as TextRole[]) {
      const v = await mount(<Text testID="t" role={role}>Milk</Text>);
      const props = screen.getByTestId('t').props;
      expect(props.allowFontScaling).toBe(true);
      expect(props.maxFontSizeMultiplier).toBe(maxFontSizeMultiplier[role]);
      expect(flat().fontSize).toBe(textStyle(role, 'latin').fontSize); // unscaled; RN applies min(scale, cap)
      await v.unmount();
    }
  });

  it('h1 cap is 1.5 and body cap 2.0', async () => {
    systemFontScale = 3;
    await mount(<Heading testID="t">Milk</Heading>);
    expect(screen.getByTestId('t').props.maxFontSizeMultiplier).toBe(1.5);
  });

  it('override mode: RN scaling off, size and line height multiplied and clamped', async () => {
    systemFontScale = 3;
    await mount(
      <TextScaleProvider scale={3}>
        <Text testID="t" role="body">দুধ</Text>
      </TextScaleProvider>,
      'bn',
    );
    const props = screen.getByTestId('t').props;
    expect(props.allowFontScaling).toBe(false);
    expect(props.maxFontSizeMultiplier).toBeUndefined();
    const base = textStyle('body', 'bengali');
    expect(flat().fontSize).toBe(base.fontSize * 2);
    expect(flat().lineHeight).toBe(base.lineHeight * 2);
  });

  it('override mode clamps h1 at 1.5 and applies 1.3 unclamped', async () => {
    const h1 = await mount(
      <TextScaleProvider scale={2}>
        <Heading testID="t">Milk</Heading>
      </TextScaleProvider>,
    );
    expect(flat().fontSize).toBe(textStyle('h1', 'latin').fontSize * 1.5);
    await h1.unmount();
    await mount(
      <TextScaleProvider scale={1.3}>
        <Text testID="t">Milk</Text>
      </TextScaleProvider>,
    );
    expect(flat().fontSize).toBeCloseTo(15 * 1.3, 2);
  });
});

describe('Text colour tokens', () => {
  it('defaults to foreground, resolved per scheme', async () => {
    const light = await mount(<Text testID="t">Milk</Text>);
    expect(flat().color).toBe(allColors.light.foreground);
    await light.unmount();
    scheme = 'dark';
    await mount(<Text testID="t">Milk</Text>);
    expect(flat().color).toBe(allColors.dark.foreground);
  });

  it('resolves a named token and the tint-safe rule', async () => {
    const a = await mount(<Text testID="t" color="mutedForeground">Milk</Text>);
    expect(flat().color).toBe(allColors.light.mutedForeground);
    await a.unmount();
    await mount(
      <Text testID="t" color="mutedForeground" onTint="infoTint">
        Milk
      </Text>,
    );
    expect(flat().color).toBe(allColors.light.foreground);
  });
});

describe('Heading', () => {
  it('is an accessibility header with h1 default and h2 option', async () => {
    const a = await mount(<Heading testID="t">Milk</Heading>);
    expect(screen.getByTestId('t').props.accessibilityRole).toBe('header');
    expect(flat().fontSize).toBe(26);
    await a.unmount();
    await mount(
      <Heading testID="t" role="h2">
        Milk
      </Heading>,
    );
    expect(screen.getByTestId('t').props.accessibilityRole).toBe('header');
    expect(flat().fontSize).toBe(20);
  });
});
