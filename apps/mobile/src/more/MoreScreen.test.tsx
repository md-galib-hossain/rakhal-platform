import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import More from '../../app/(tabs)/more.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { syncHarness } from '../test-utils/sync-harness.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

afterEach(restoreMount);

async function open(locale: 'en' | 'bn' = 'en') {
  const h = syncHarness();
  await mount(
    <h.Tree>
      <More />
    </h.Tree>,
    { locale },
  );
  await waitFor(() => expect(h.sync().ready).toBe(true));
  return h;
}

describe('MoreScreen: language settings', () => {
  it('renders the language section card with বাং and EN toggles', async () => {
    await open('en');
    expect(screen.getByTestId('more-language-section')).toBeTruthy();
    expect(screen.getByTestId('more-language-bn')).toBeTruthy();
    expect(screen.getByTestId('more-language-en')).toBeTruthy();
  });

  it('reflects active and resting state based on current locale and allows switching', async () => {
    await open('bn');
    const bnBtn = screen.getByTestId('more-language-bn');
    const enBtn = screen.getByTestId('more-language-en');

    expect(bnBtn.props.accessibilityState).toMatchObject({ selected: true });
    expect(enBtn.props.accessibilityState).toMatchObject({ selected: false });

    await act(async () => {
      fireEvent.press(enBtn);
    });

    expect(enBtn.props.accessibilityState).toMatchObject({ selected: true });
    expect(bnBtn.props.accessibilityState).toMatchObject({ selected: false });

    await act(async () => {
      fireEvent.press(bnBtn);
    });

    expect(bnBtn.props.accessibilityState).toMatchObject({ selected: true });
    expect(enBtn.props.accessibilityState).toMatchObject({ selected: false });
  });
});
