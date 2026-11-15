import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { fail, fakeApi, ok, sessionReply, type Handler } from '../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { LoginScreen } from './LoginScreen.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));

afterEach(restoreMount);

const identifier = () => screen.getByTestId('login-identifier');
const password = () => screen.getByTestId('login-password');
const submit = () => screen.getByTestId('login-submit');

async function open(handler: Handler, stored: { refreshToken: string; farmId: string } | null = null, locale: 'en' | 'bn' = 'en') {
  const api = fakeApi(handler, stored);
  await mount(
    <api.Wrapper>
      <LoginScreen />
    </api.Wrapper>,
    { locale },
  );
  return api;
}

async function type(el: ReturnType<typeof identifier>, text: string) {
  await act(async () => {
    fireEvent.changeText(el, text);
  });
}

describe('LoginScreen', () => {
  it('validates before any request: empty identifier and a short password show inline errors', async () => {
    const api = await open(() => ok({}));
    await type(password(), 'short');
    await act(async () => {
      fireEvent.press(submit());
    });
    expect(await screen.findByText('Enter your email or username.', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Password must be at least 8 characters.', { includeHiddenElements: true })).toBeTruthy();
    expect(api.requests.filter((r) => r.url.endsWith('/auth/login'))).toHaveLength(0);
  });

  it('signs in with the trimmed identifier and the password as typed (password never trimmed)', async () => {
    const api = await open((url) => (url.endsWith('/auth/login') ? sessionReply(1) : ok({})));
    await type(identifier(), '  rahim.uddin ');
    await type(password(), ' pw-123456 ');
    await act(async () => {
      fireEvent.press(submit());
    });
    await waitFor(() => expect(api.requests.some((r) => r.url.endsWith('/auth/login'))).toBe(true));
    const login = api.requests.find((r) => r.url.endsWith('/auth/login'));
    expect(login?.body).toEqual({ identifier: 'rahim.uddin', password: ' pw-123456 ' });
    await waitFor(() => expect(api.store.peek()?.refreshToken).toBe('refresh-1'));
  });

  it.each([
    ['wrong credentials / locked (401)', fail(401, 'Invalid credentials'), /not correct.*locked for 15 minutes/],
    ['too many tries (429)', fail(429, 'slow down'), /Too many tries/],
    ['no network', 'network' as const, /No internet connection/],
    ['server problem (503)', fail(503, 'down'), /server had a problem/],
  ])('shows a distinct message for %s', async (_name, reply, pattern) => {
    await open((url) => (url.endsWith('/auth/login') ? reply : ok({})));
    await type(identifier(), 'rahim');
    await type(password(), 'pw-123456');
    await act(async () => {
      fireEvent.press(submit());
    });
    const error = await screen.findByTestId('login-form-error');
    expect(error).toHaveTextContent(pattern);
  });

  it('hides the password by default and the toggle reveals it', async () => {
    await open(() => ok({}));
    expect(password().props.secureTextEntry).toBe(true);
    await act(async () => {
      fireEvent.press(screen.getByText('Show password'));
    });
    expect(password().props.secureTextEntry).toBe(false);
    expect(screen.getByText('Hide password')).toBeTruthy();
  });

  it('tells the user when the server ended their session', async () => {
    await open((url) => (url.endsWith('/auth/refresh') ? fail(401, 'Invalid refresh token') : ok({})), {
      refreshToken: 'refresh-0',
      farmId: 'farm-1',
    });
    expect(await screen.findByTestId('login-expired-notice')).toBeTruthy();
    expect(screen.getByText('You were signed out')).toBeTruthy();
  });

  it('does not show the expired notice on a fresh start', async () => {
    await open(() => ok({}));
    await waitFor(() => expect(screen.getAllByText('Sign in').length).toBeGreaterThan(0));
    expect(screen.queryByTestId('login-expired-notice')).toBeNull();
  });

  it('language chips switch the screen language on the spot', async () => {
    await open(() => ok({}), null, 'en');
    expect(screen.getByText('Email or username', { includeHiddenElements: true })).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-language-bn'));
    });
    expect(await screen.findByText('ইমেইল বা ইউজারনেম', { includeHiddenElements: true })).toBeTruthy();
  });

  it('keeps showing the error in the language the user switches to (errors are keys, not stored text)', async () => {
    await open((url) => (url.endsWith('/auth/login') ? fail(401, 'Invalid credentials') : ok({})), null, 'en');
    await type(identifier(), 'rahim');
    await type(password(), 'pw-123456');
    await act(async () => {
      fireEvent.press(submit());
    });
    expect(await screen.findByTestId('login-form-error')).toHaveTextContent(/is not correct/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('login-language-bn'));
    });
    await waitFor(() => expect(screen.getByTestId('login-form-error')).toHaveTextContent(/সঠিক নয়/));
  });

  it('opens in Bangla when that is the stored language', async () => {
    await open(() => ok({}), null, 'bn');
    expect(screen.getByText('পাসওয়ার্ড', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('আপনার ইমেইল বা ইউজারনেম দিন।')).toBeTruthy();
  });
});
