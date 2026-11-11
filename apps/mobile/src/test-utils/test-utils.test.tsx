import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { screen } from '@testing-library/react-native';
import { Text, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { allColors } from '../theme/tokens.ts';
import { mount, restoreMount } from './mount.tsx';
import { expectNoFixedTextHeight, expectTouchTarget, findNodes } from './touch-target.ts';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

function Probe() {
  const { scheme } = useTheme();
  const { locale, digits } = useLocale();
  const { fontScale } = useWindowDimensions();
  return <Text testID="probe">{`${scheme}|${locale}|${digits}|${fontScale}`}</Text>;
}

describe('mount', () => {
  it('defaults to light / en / latn / 1', async () => {
    await mount(<Probe />);
    expect(screen.getByTestId('probe').props.children).toBe('light|en|latn|1');
  });

  it('applies scheme, locale, digits and system font scale, and exposes the colour tokens', async () => {
    const view = await mount(<Probe />, { scheme: 'dark', locale: 'bn', digits: 'beng', fontScale: 2 });
    expect(screen.getByTestId('probe').props.children).toBe('dark|bn|beng|2');
    expect(view.colors).toBe(allColors.dark);
  });
});

describe('expectTouchTarget', () => {
  it('passes for minHeight at or above the target, with or without width', async () => {
    await mount(<View testID="a" style={{ minHeight: 56 }} />);
    expect(() => expectTouchTarget(screen.getByTestId('a'), 48)).not.toThrow();
    expect(() => expectTouchTarget(screen.getByTestId('a'), 56)).not.toThrow();
  });

  it('fails when the height is missing, below target, or a smaller fixed height hides behind a big minHeight', async () => {
    await mount(
      <>
        <View testID="none" />
        <View testID="low" style={{ minHeight: 40 }} />
        <View testID="mixed" style={{ minHeight: 56, height: 30 }} />
      </>,
    );
    expect(() => expectTouchTarget(screen.getByTestId('none'), 48)).toThrow(/no minHeight/);
    expect(() => expectTouchTarget(screen.getByTestId('low'), 48)).toThrow(/below/);
    expect(() => expectTouchTarget(screen.getByTestId('mixed'), 48)).toThrow(/height 30/);
  });

  it('checks width when declared or required', async () => {
    await mount(
      <>
        <View testID="sq" style={{ minHeight: 48, minWidth: 48 }} />
        <View testID="narrow" style={{ minHeight: 48, minWidth: 30 }} />
        <View testID="nowidth" style={{ minHeight: 48 }} />
      </>,
    );
    expect(() => expectTouchTarget(screen.getByTestId('sq'), 48, { requireWidth: true })).not.toThrow();
    expect(() => expectTouchTarget(screen.getByTestId('narrow'), 48)).toThrow(/minWidth 30/);
    expect(() => expectTouchTarget(screen.getByTestId('nowidth'), 48, { requireWidth: true })).toThrow(/no minWidth/);
  });
});

describe('expectNoFixedTextHeight / findNodes', () => {
  it('flags a fixed height on a text holder and on the text itself, but not on a non-text box', async () => {
    await mount(
      <>
        <View testID="ok" style={{ height: 20, width: 20 }}>
          <View style={{ height: 4 }} />
        </View>
        <View testID="holder" style={{ height: 40 }}>
          <Text>x</Text>
        </View>
        <View testID="plain">
          <Text style={{ height: 10 }}>y</Text>
        </View>
        <View testID="fine" style={{ minHeight: 40 }}>
          <Text>z</Text>
        </View>
      </>,
    );
    expect(() => expectNoFixedTextHeight(screen.getByTestId('ok'))).not.toThrow();
    expect(() => expectNoFixedTextHeight(screen.getByTestId('fine'))).not.toThrow();
    expect(() => expectNoFixedTextHeight(screen.getByTestId('holder'))).toThrow(/Fixed height/);
    expect(() => expectNoFixedTextHeight(screen.getByTestId('plain'))).toThrow(/Fixed height/);
    expect(findNodes(screen.getByTestId('holder'), (n) => n.type === 'Text')).toHaveLength(1);
  });
});
