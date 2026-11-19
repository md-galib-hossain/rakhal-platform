import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fail, fakeApi, ok, type Handler } from '../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { RegisterScreen } from './RegisterScreen.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));

afterEach(() => {
  restoreMount();
  jest.clearAllMocks();
});

const nameInput = () => screen.getByTestId('register-name');
const emailInput = () => screen.getByTestId('register-email');
const passwordInput = () => screen.getByTestId('register-password');
const submitButton = () => screen.getByTestId('register-submit');
const togglePasswordButton = () => screen.getByTestId('register-toggle-password');

async function type(element: ReturnType<typeof nameInput>, text: string) {
  await act(async () => {
    fireEvent.changeText(element, text);
  });
}

async function open(handler: Handler, locale: 'en' | 'bn' = 'en') {
  const api = fakeApi(handler, null);
  await mount(
    <api.Wrapper>
      <RegisterScreen />
    </api.Wrapper>,
    { locale },
  );
  return api;
}

describe('RegisterScreen', () => {
  it('validates required fields before sending request', async () => {
    const api = await open(() => ok({}));
    await act(async () => {
      fireEvent.press(submitButton());
    });
    expect(await screen.findByText('Enter your full name.', { includeHiddenElements: true })).toBeTruthy();
    expect(await screen.findByText('Enter your email address.', { includeHiddenElements: true })).toBeTruthy();
    expect(await screen.findByText('Password must be at least 8 characters.', { includeHiddenElements: true })).toBeTruthy();
    expect(api.requests.filter((r) => r.url.endsWith('/auth/register'))).toHaveLength(0);
  });

  it('validates invalid email format and short password', async () => {
    const api = await open(() => ok({}));
    await type(nameInput(), 'Rahim Uddin');
    await type(emailInput(), 'bad-email');
    await type(passwordInput(), '1234');
    await act(async () => {
      fireEvent.press(submitButton());
    });
    expect(await screen.findByText('Enter a valid email address.', { includeHiddenElements: true })).toBeTruthy();
    expect(await screen.findByText('Password must be at least 8 characters.', { includeHiddenElements: true })).toBeTruthy();
    expect(api.requests.filter((r) => r.url.endsWith('/auth/register'))).toHaveLength(0);
  });

  it('toggles password visibility with the eye icon', async () => {
    await open(() => ok({}));
    expect(passwordInput().props.secureTextEntry).toBe(true);

    await act(async () => {
      fireEvent.press(togglePasswordButton());
    });
    expect(passwordInput().props.secureTextEntry).toBe(false);

    await act(async () => {
      fireEvent.press(togglePasswordButton());
    });
    expect(passwordInput().props.secureTextEntry).toBe(true);
  });

  it('submits valid registration, auto-signs in, and navigates to /farm', async () => {
    const api = await open((url) => {
      if (url.endsWith('/auth/register')) {
        return ok({ user: { id: 'user-1', email: 'rahim@example.com', name: 'Rahim Uddin' } });
      }
      if (url.endsWith('/auth/login')) {
        return ok({
          accessToken: 'acc-1',
          refreshToken: 'ref-1',
          sessionId: 'sess-1',
          needsFarm: true,
          farms: [],
          user: { id: 'user-1', email: 'rahim@example.com', name: 'Rahim Uddin' },
        });
      }
      return ok({});
    });

    await type(nameInput(), '  Rahim Uddin  ');
    await type(emailInput(), '  rahim@example.com  ');
    await type(passwordInput(), 'securePass123');
    await act(async () => {
      fireEvent.press(submitButton());
    });

    await waitFor(() => {
      expect(api.requests.some((r) => r.url.endsWith('/auth/register'))).toBe(true);
    });

    const regReq = api.requests.find((r) => r.url.endsWith('/auth/register'));
    expect(regReq?.body).toEqual({
      name: 'Rahim Uddin',
      email: 'rahim@example.com',
      password: 'securePass123',
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/farm');
    });
  });

  it('displays error when email is already taken (409 Conflict)', async () => {
    await open((url) => (url.endsWith('/auth/register') ? fail(409, 'Email already exists') : ok({})));

    await type(nameInput(), 'Rahim Uddin');
    await type(emailInput(), 'existing@example.com');
    await type(passwordInput(), 'securePass123');
    await act(async () => {
      fireEvent.press(submitButton());
    });

    const formError = await screen.findByTestId('register-form-error');
    expect(formError).toHaveTextContent(/An account with this email already exists/);
  });

  it('navigates to /login when back-to-login link is pressed', async () => {
    await open(() => ok({}));
    await act(async () => {
      fireEvent.press(screen.getByTestId('register-back-to-login'));
    });
    expect(router.push).toHaveBeenCalledWith('/login');
  });

  it('switches language between English and Bangla', async () => {
    await open(() => ok({}), 'en');
    expect(screen.getByTestId('register-submit')).toHaveTextContent('Create account');

    await act(async () => {
      fireEvent.press(screen.getByTestId('register-language-bn'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('register-submit')).toHaveTextContent('নিবন্ধন করুন');
    });
  });
});
