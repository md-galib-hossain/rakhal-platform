import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fail, fakeApi, ok, type Handler } from '../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { ForgotPasswordScreen } from './ForgotPasswordScreen.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));

afterEach(() => {
  restoreMount();
  jest.clearAllMocks();
});

const emailInput = () => screen.getByTestId('forgot-password-email');
const submitButton = () => screen.getByTestId('forgot-password-submit');

async function open(handler: Handler, locale: 'en' | 'bn' = 'en') {
  const api = fakeApi(handler, null);
  await mount(
    <api.Wrapper>
      <ForgotPasswordScreen />
    </api.Wrapper>,
    { locale },
  );
  return api;
}

async function typeEmail(text: string) {
  await act(async () => {
    fireEvent.changeText(emailInput(), text);
  });
}

describe('ForgotPasswordScreen', () => {
  it('validates before request: empty email shows required error', async () => {
    const api = await open(() => ok({ success: true }));
    await act(async () => {
      fireEvent.press(submitButton());
    });
    expect(await screen.findByText('Enter your email address.', { includeHiddenElements: true })).toBeTruthy();
    expect(api.requests.filter((r) => r.url.endsWith('/auth/forgot-password'))).toHaveLength(0);
  });

  it('validates before request: invalid email format shows error', async () => {
    const api = await open(() => ok({ success: true }));
    await typeEmail('notanemail');
    await act(async () => {
      fireEvent.press(submitButton());
    });
    expect(await screen.findByText('Enter a valid email address.', { includeHiddenElements: true })).toBeTruthy();
    expect(api.requests.filter((r) => r.url.endsWith('/auth/forgot-password'))).toHaveLength(0);
  });

  it('submits valid email and transitions to success view', async () => {
    const api = await open((url) =>
      url.endsWith('/auth/forgot-password') ? ok({ success: true }) : ok({}),
    );
    await typeEmail('  worker@rakhal.test  ');
    await act(async () => {
      fireEvent.press(submitButton());
    });

    await waitFor(() => {
      expect(api.requests.some((r) => r.url.endsWith('/auth/forgot-password'))).toBe(true);
    });
    const req = api.requests.find((r) => r.url.endsWith('/auth/forgot-password'));
    expect(req?.body).toEqual({ email: 'worker@rakhal.test' });

    expect(await screen.findByTestId('forgot-password-success-view')).toBeTruthy();
    expect(screen.getByText('Check your email')).toBeTruthy();
    expect(screen.getByText(/worker@rakhal\.test/)).toBeTruthy();

    // Clicking back to login replaces route
    await act(async () => {
      fireEvent.press(screen.getByTestId('forgot-password-back-login'));
    });
    expect(router.replace).toHaveBeenCalledWith('/login');
  });

  it('handles server rate limits and network errors', async () => {
    await open((url) => (url.endsWith('/auth/forgot-password') ? fail(429, 'too fast') : ok({})));
    await typeEmail('manager@rakhal.test');
    await act(async () => {
      fireEvent.press(submitButton());
    });
    const error = await screen.findByTestId('forgot-password-form-error');
    expect(error).toHaveTextContent(/Too many tries/);
  });

  it('cancel button navigates back to login', async () => {
    await open(() => ok({}));
    await act(async () => {
      fireEvent.press(screen.getByTestId('forgot-password-cancel'));
    });
    expect(router.replace).toHaveBeenCalledWith('/login');
  });

  it('toggles language between English and Bangla', async () => {
    await open(() => ok({}), 'en');
    expect(screen.getByText('Email address', { includeHiddenElements: true })).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('forgot-password-language-bn'));
    });
    expect(await screen.findByText('ইমেইল ঠিকানা', { includeHiddenElements: true })).toBeTruthy();
  });
});
