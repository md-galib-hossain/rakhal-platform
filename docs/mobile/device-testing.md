# Running the mobile app on the Android emulator (Windows)

Verified 2026-11-15 on a Pixel 8 AVD (Android 17 image, Expo Go for SDK 58) against the local API.

## 1. Backend
1. Docker Desktop up with Postgres and Redis (`rakhal-postgres`, `rakhal-redis`), demo data seeded (`pnpm seed` in `apps/api`).
2. `apps/api/.env` present (gitignored). In a git worktree copy it from the main checkout; drop a placeholder `SENTRY_DSN=https://<key>@...` line if the shell chokes on it.
3. `pnpm start:dev` in `apps/api`. It listens on `PORT` from `.env` (5005 in the maintainer's setup, 5000 is the code default). Check `http://localhost:<port>/health`.
4. Demo accounts: `owner@demo.rakhal.test` / `DemoPass123` (also `manager@` and `worker@`). The demo owner has many leftover `E2E ...` farms, so the farm picker is long.

## 2. Metro / Expo Go
```bash
cd apps/mobile
EXPO_PUBLIC_API_PORT=5005 pnpm exec expo start --android   # API on 5005; omit when the API uses 5000
```
- In development the API address is derived from the Metro host (Expo's `hostUri`) plus `EXPO_PUBLIC_API_PORT` (default 5000). Set `EXPO_PUBLIC_API_BASE_URL` to override it completely (required for a release build).
- Do **not** rely on `10.0.2.2`: on the Pixel 8 / Android 17 emulator, Expo Go requests to it hung until the app's 20 s timeout although Chrome in the same emulator reached the same address. The LAN address of the machine worked.
- First launch downloads Expo Go to the emulator. A second `expo start` needs port 8081 free (kill the old Metro with `taskkill /PID <pid> /T /F`).

## 2b. Emulator quirks seen
- An emulator stuck on the Google logo with `Can't find service: package` from `adb shell` never finishes booting: `adb emu kill`, then `emulator -avd Pixel_8 -no-snapshot-load` (a cold boot was ready in about a minute).
- After `am force-stop host.exp.exponent` the first `am start -a android.intent.action.VIEW -d exp://<host>:8081 host.exp.exponent` sometimes shows the launcher instead of the app; run it again.
- Pressing Back with the keyboard already hidden leaves the app.
- Git Bash rewrites `/sdcard/...` arguments; use `MSYS_NO_PATHCONV=1` for `adb pull`/`uiautomator dump`.

## 3. Checked on the device
Bangla and English sign-in, validation, wrong password, login by email, farm picker (login list and `GET /farms`), choosing a farm, session restore after a cold start, cold start with the API down (stays signed in), network error with retry, session revoked by the server (`logout-all`) showing "You were signed out", sign out, Android Back.
Not covered yet: login by username (no demo user has one), TalkBack, 200% font scale, dark theme, physical device, iOS.

## 4. Useful commands
```bash
adb exec-out screencap -p > screen.png                # screenshot
adb shell uiautomator dump /sdcard/ui.xml              # view bounds and text (check clipped labels)
adb shell input tap X Y ; adb shell input text "..."   # drive the UI
```

## 5. WP6 navigation shell, checked on the device (2026-11-15)
Header with the farm name (tap opens the farm picker) and a language toggle; five bottom tabs (Home, Cattle, Milk, Tasks, More) with the selected tab marked; Milk shows the "coming soon" state; More shows the account section (name, farm, change farm, sign out); Bangla labels render in full in the shell; killing the app on More and relaunching returns to More (last tab restored); Android Back from a tab goes to Home first.
Not covered on the device: a role without cattle/milk/task permission (the demo manager, worker and owner all hold them; hiding is covered by Jest), TalkBack, dark theme.

## 6. WP8b offline foundation, checked on the device (2026-11-15)
Header pill and sheet; `expo-sqlite` outbox and cache in Expo Go; the sync loop. How it was checked on the Pixel 8:
- Signed in as the demo owner: the pill reads **Synced** after the first pull (sheds, milk tanks, cattle, tasks).
- Dev builds only: **More > "Queue a test milk entry (dev)"** queues one harmless milk save (a day 400 days ahead, the first cached cow, `baseUpdatedAt: null`).
- **Offline:** `adb shell svc wifi disable` and `svc data disable`. The pill turns to **Offline** and, after queuing, **Offline, 1 pending**. Tapping it opens "Saved on this phone" with the entry and a "Waiting" badge.
- **Kill and restart with the queue on disk:** Expo Go cannot load the bundle with the phone's Wi-Fi off (it needs Metro), so test it with the phone connected and the **API stopped**: the pill still reads "Offline, 1 pending" on a cold start even though the profile has not loaded (the queue is found under the database owner).
- **Reconnect:** start the API again. The queued write is sent by itself (about 30 s retry), the pill returns to **Synced**, and the server holds exactly one milk row plus one `IdempotencyKey` row for the phone's UUID key (user and request hash recorded, response stored).
- Clean up afterwards: delete the test row (`MilkLogEntry` for that far-future day) and its key.
Not covered on the device: a conflict (needs two devices or a second login editing the same cow and day), a rejected entry, Bangla in the sheet, TalkBack, 200% font scale, dark theme, a physical device, iOS.
