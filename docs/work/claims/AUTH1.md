---
id: AUTH1
title: "Mobile: Native forgot password request screen and login recovery link"
status: done
agent: nexus
harness: antigravity
branch: feat/mobile-forgot-password
paths:
  - apps/mobile/app/forgot-password.tsx
  - apps/mobile/src/screens/ForgotPasswordScreen.tsx
  - apps/mobile/src/screens/ForgotPasswordScreen.test.tsx
  - apps/mobile/src/screens/LoginScreen.tsx
  - apps/mobile/src/screens/LoginScreen.test.tsx
  - apps/mobile/src/auth/auth-route.ts
  - apps/mobile/test/auth-route.test.ts
  - apps/mobile/src/components/forms/TextField.tsx
  - apps/mobile/src/components/forms/TextField.test.tsx
  - apps/mobile/src/assets/icons/EyeIcon.tsx
  - apps/mobile/src/assets/icons/EyeOffIcon.tsx
  - apps/mobile/src/offline/expo-sqlite-db.ts
  - apps/mobile/app/register.tsx
  - apps/mobile/src/screens/RegisterScreen.tsx
  - apps/mobile/src/screens/RegisterScreen.test.tsx
shared:
  - apps/mobile/src/i18n/messages.ts
depends_on: []
blocked_by: []
resolved: []
started: 2026-11-18
updated: 2026-11-19
---

## Scope

Add mobile password recovery and login assistance:
1. Routing:
   - Allow `/forgot-password` in `auth-route.ts` as a public/signed-out route so AuthGate does not redirect back to `/login`.
   - Add `app/forgot-password.tsx` route exporting `ForgotPasswordScreen`.
2. Login screen (`LoginScreen.tsx`):
   - Add "Forgot password?" / "পাসওয়ার্ড ভুলে গেছেন?" button linking to `/forgot-password`.
   - Add subtle helper note about web portal registration for new farms.
3. Forgot password screen (`ForgotPasswordScreen.tsx`):
   - Form with email input validation and language toggle (Bangla/English).
   - Calls `POST /auth/forgot-password` via `useAuth().client` without credentials.
   - Informative success card showing confirmation, inbox instruction, and guidance for farm workers without email to contact their farm manager.
   - "Back to sign in" navigation button.
4. Native Registration screen (`RegisterScreen.tsx`):
   - Form with Full Name, Email, Password (with eye toggle), and language switcher.
   - Direct native registration via `POST /auth/register` with `{ name, email, password }`.
   - On success, auto-signs in with `useAuth().signIn(email, password)`.
   - Handles email already taken (409), invalid input, rate limiting, and network failure.
   - "Already have an account? Sign in" navigation link.
5. i18n & Tests:
   - Complete parity for all keys in `messages.ts` (en & bn).
   - Unit tests for `auth-route.ts`.
   - Component tests for `ForgotPasswordScreen.tsx`.

## Verification results

- `pnpm exec tsc --noEmit`: 0 errors.
- `pnpm exec eslint .`: 0 errors, 0 warnings.
- `pnpm run test:node`: 326 tests passed (0 failures) + token drift check clean.
- `pnpm exec jest --ci`: 45 test suites passed, 548 tests passed (0 failures).
- Device verification (Pixel 8 Android emulator, `emulator-5554`):
  - In-app Sign In screen: "Don't have an account? Sign up" / "অ্যাকাউন্ট নেই? নিবন্ধন" link navigates directly to `/register`.
  - In-app Register screen (`/register`):
    - Full name, Email, Password (with interactive inline `EyeIcon` / `EyeOffIcon` toggle).
    - Validation on empty fields, invalid email format, and short password (< 8 chars).
    - Language switcher toggles between Bangla and English cleanly.
    - Submit calls backend `POST /api/v1/auth/register`, auto-authenticates via `signIn()`, and transitions to `/farm`.
  - Error copy fix: Wrong credentials display clear, non-alarming copy ("Incorrect email, username or password. Please try again." / "ইমেইল, ইউজারনেম বা পাসওয়ার্ড সঠিক নয়। আবার চেষ্টা করুন।") without falsely claiming a 15-minute lockout.

- `pnpm exec tsc --noEmit`: PASSED (0 errors)
- `pnpm exec eslint .`: PASSED (0 errors, 0 warnings)
- `node --test apps/mobile/test/no-shadows.test.ts`: PASSED (5/5 tests passing, zero drop shadows)
- `pnpm run test:node`: PASSED (326/326 tests passing, 0 token drift)
- `pnpm exec jest --ci`: PASSED (44 test suites, 538 tests passing)
- `node scripts/work.mjs check --no-network`: PASSED (0 errors, 0 warnings)
