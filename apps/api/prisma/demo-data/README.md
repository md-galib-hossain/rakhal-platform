# Demo dataset (`prisma/demo-data/`)

One JSON file per table, loaded by `prisma/seed-demo-data.ts` (called at the end of
`pnpm seed`). Everything is **idempotent** — rows carry fixed ids (`sd_*`) and are
upserted, so re-running the seed after clearing the DB always reproduces the same
consistent dataset. Non-production only.

## Token conventions (resolved at seed time)

| Token | Resolves to |
|---|---|
| `@farm` / `@farm2` | Demo Farm / Green Valley Dairy (second farm) id |
| `@user:owner\|manager\|worker\|worker2\|neighbor` | seeded user ids |
| `@role:owner\|manager\|worker` | system role ids |
| `@plan:Free\|Starter\|Pro` | subscription plan ids |
| `@legal:TERMS\|PRIVACY` | current (v1.0) legal document ids |
| `@now` | seed run time |
| `@daysAgo:N` / `@daysFromNow:N` | now ± N days (N can be fractional) |
| `@dayStart:N` | UTC midnight N days ago (use for `logDate`-style day fields) |
| `@monthsAgo:N` | now − N months |

Dates are **relative to the seed run**, so “overdue”, “due today”, “near expiry”
etc. stay true no matter when you reseed.

## Consistency map (the story the data tells)

- **Herd (20)**: RKL-001..006 + 020 milking · 007/008 dry (007 pregnant, due ~1 month)
  · 009–011 heifers (009 bred) · 012 breeding bull “Raja” · 013–016 calves
  (013→dam 001, 014→dam 003, 015→dam 008 weaned, 016 purchased) · 017 sold ·
  018 dead (mortality case HC-00003) · 019 recovered FMD case, aborted earlier.
- **Health**: HC-00001 = active mastitis on RKL-005 (plan `sd_healthplan_mastitis`,
  2/5 steps done, milk withholding active → her milk logs go to the WITHHOLDING tank).
- **Milk**: evening session logs for the last 5 days + today’s unsubmitted drafts;
  base seed (`seedDemoDashboardHistory`) already generates the morning-month history.
- **Money**: dispatches ↔ revenue transactions ↔ receivables (one overdue);
  loan ↔ EMI transactions; medicine/feed purchases ↔ stock movements; a voided pair.
- **Billing**: demo farm = paid yearly Pro invoice; farm2 = referred signup
  (referral code `DEMO-FARM-2026`), coupon `WELCOME10` redeemed, commission accrued.
- **Skipped tables** (runtime/security/service-owned — the app or the base
  seed creates these itself): Session, RefreshToken, AuthToken, OAuthAccount,
  UserMFA, OtpChallenge, DeviceToken (needs real FCM tokens), MediaAsset
  (needs real R2 objects), RenewalReminder (sweep-owned), ActivityLog (hash-
  chained — must go through `ActivityLogService`, never raw-inserted),
  PlatformAdminAuditLog, ReconciliationException, EmailLog,
  NotificationRoutingRule, InvoiceCounter/Permission/Role/RolePermission/
  Feature/SubscriptionFeature/SubscriptionPlan/FeedIngredient/ReproProtocol(Step)/
  LegalDocument/PlatformAdmin (base `prisma/seed.ts` owns these catalogues).

Task refs are `TSK-001..` and case codes `HC-00001..` so the app’s
count/max-based generators continue cleanly after the seed.
