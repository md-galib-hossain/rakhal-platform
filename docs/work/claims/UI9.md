---
id: UI9
title: "Mobile: Notifications Panel (Inbox, Upcoming, New Composer, Preferences) adhering to ADR-007"
status: done
agent: nexus
harness: antigravity
branch: main
paths:
  - apps/mobile/src/notifications/**
  - apps/mobile/src/navigation/AppHeader.tsx
  - apps/mobile/app/(tabs)/_layout.tsx
  - apps/mobile/test/**
shared:
  - apps/mobile/src/i18n/messages.ts
depends_on: []
blocked_by: []
resolved: []
started: 2026-11-21
updated: 2026-11-21
---

## Scope & Implementation Notes

1. **Design & Components**:
   - `NotificationSheet.tsx`: Bottom/slide sheet modal hosting segmented tabs (Inbox, Upcoming, New) and header preferences toggle.
   - `InboxTab.tsx`: Paginated notification items, priority badges (Critical, High, Medium, Low), unread indicator, All/Unread filter, and Mark All Read.
   - `UpcomingTab.tsx`: Scheduled notification occurrences grouped by day with Today / 7 days / 14 days filters, and pause/resume/cancel/edit capabilities.
   - `NewTab.tsx`: Manual notification composer matching web screenshots (title, notes, date, time-of-day/all-day, notify-me lead time, repeat rules, audience me/roles/people, animal picker, and dynamic preview card).
   - `NotificationPreferencesView.tsx`: Channel toggles (In-app, Push, SMS, WhatsApp, Telegram, Email), quiet hours, and Telegram link status.
   - Strict ADR-007 compliance: zero drop shadows, 1px border separation, 48dp minimum touch targets.

2. **Integration**:
   - Connect header notification bell in `AppHeader.tsx` to open the notification sheet and show an unread dot badge when `unread_count > 0`.
   - Bilingual copy in `apps/mobile/src/i18n/messages.ts` (English & Bengali).

## Verification
- `tsc --noEmit`: 0 errors.
- `eslint .`: 0 errors, 0 warnings.
- `no-shadows.test.ts`: 5/5 passed.
- `test:node`: 336/336 passed (including bilingual dictionary parity in `messages.test.ts`).
- `jest src/notifications/NotificationSheet.test.tsx`: passed.
- `work.mjs check --no-network`: 0 errors, 0 warnings.
- Android Pixel 8 emulator: Verified header bell tap opens modal sheet, Inbox filters, Upcoming ranges, New composer with 10 form sections, dynamic preview card, Preferences toggle, and close/dismiss.
