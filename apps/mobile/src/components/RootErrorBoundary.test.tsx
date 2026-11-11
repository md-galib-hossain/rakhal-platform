import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { LocaleProvider } from '../providers/LocaleProvider.tsx';
import { ThemeProvider } from '../providers/ThemeProvider.tsx';
import { memoryPrefs, PREF_KEYS, type Prefs } from '../storage/prefs.ts';
import { colorsDark } from '../theme/tokens.ts';
import { RootErrorBoundary } from './RootErrorBoundary.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error('kaboom');
  return <Text>recovered</Text>;
}

let errorSpy: ReturnType<typeof jest.spyOn>;
beforeEach(() => {
  shouldThrow = true;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

function mount(locale: Prefs['locale']) {
  const storage = memoryPrefs({ [PREF_KEYS.theme]: 'dark', [PREF_KEYS.locale]: locale });
  return render(
    <ThemeProvider storage={storage}>
      <LocaleProvider storage={storage}>
        <RootErrorBoundary>
          <Bomb />
        </RootErrorBoundary>
      </LocaleProvider>
    </ThemeProvider>,
  );
}

describe('RootErrorBoundary', () => {
  it('shows a themed English fallback, logs the error, and retry resets the boundary', async () => {
    await mount('en');
    expect(await screen.findByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toHaveStyle({ color: colorsDark.foreground });
    const calls = errorSpy.mock.calls as unknown[][];
    expect(calls.some((call) => call.some((arg) => arg instanceof Error && arg.message === 'kaboom'))).toBe(true);

    shouldThrow = false;
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('recovered')).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('renders the Bangla fallback by default', async () => {
    await mount('bn');
    expect(await screen.findByText('কিছু একটা ভুল হয়েছে')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'আবার চেষ্টা করুন' })).toBeTruthy();
  });

  it('keeps showing the fallback when retry throws again', async () => {
    await mount('en');
    fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Something went wrong')).toBeTruthy();
  });
});
