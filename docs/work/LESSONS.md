# Lessons (append-only)

Hard-won traps. Add an entry at the bottom: **date, who, what happened, the fix.** Never edit or delete old entries; add a correction as a new one.

## 2026-11-16, repo owner sessions (seeded from `AGENTS.md`)

- **Jest finds nothing inside a git worktree under `.claude/`.** Default `testMatch` skips the path. Fix: `pnpm exec jest --ci --testMatch "**/src/**/*.test.tsx"` in `apps/mobile`.
- **`expo install` reformats `app.json`.** Undo the formatting churn before committing (it shows up as an unrelated diff).
- **Expo Go cannot load the bundle with Wi-Fi off.** Test offline by keeping the phone connected and stopping the API.
- **`10.0.2.2` hangs on the Pixel 8 emulator image.** The app derives the API address from Metro's host: start with `EXPO_PUBLIC_API_PORT=<port> pnpm exec expo start --port 8081 --clear` and open `exp://<LAN IP>:8081`.
- **Prisma asks to reset the database because old migrations were edited.** Do not reset the shared dev DB. Write the migration SQL by hand, apply it with `prisma db execute`, then `prisma migrate resolve --applied <name>`.
- **`node:sqlite` returns null-prototype row objects.** `deepEqual` against plain objects and `instanceof Object` checks fail in `test/` helpers; copy rows (`{ ...row }`) first.
- **Harness hooks are harness-specific.** Claude Code GateGuard-style hooks deny the first Write/Edit of a file until you state facts; Antigravity has none. Neither is part of the repo, so never write a task that depends on one.
- **The e2e suite and device tests share one dev database.** Use far-future dates, create your own rows, delete them afterwards.

## 2026-11-19, Nexus / Antigravity session (AUTH1)

- **Static import of `expo-sqlite` crashes Expo Go on Metro startup if native binary is unavailable.** Static top-level `import * as SQLite from 'expo-sqlite'` executes `requireNativeModule('ExpoSQLite')` at bundle evaluation time, crashing Expo Router with `Cannot find native module 'ExpoSQLite'`. Fix: Use dynamic `import('expo-sqlite')` guarded by `isExpoSqliteAvailable()` to keep runtime fallback intact.
- **Conflating security policy copy with credential errors creates false user alarm.** Appending "After several wrong tries the account is locked for 15 minutes" to the 401 error message caused users to believe they were locked out on their very first attempt. Fix: Keep standard 401 copy purely informative ("Incorrect email, username or password. Please try again.") and reserve lockout notices strictly for actual 429 / lockout conditions.
