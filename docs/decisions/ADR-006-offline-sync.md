# ADR-006: Mobile offline sync: SQLite outbox with per-route `Idempotency-Key`

Status: **proposed** (2026-11-15). Owner decision D7 is made (per-route `Idempotency-Key`, not `/sync/push` + `/sync/pull`).
D6 (offline scope) is proposed below; accepting this ADR accepts it. Implements the "offline sync gets its own ADR before any
offline screen" rule of ADR-005 #5. Unblocks WP8a (backend) and WP8b (mobile foundation) in `docs/mobile/M4-mobile-plan-2026-11-15.md`.

## Context

- PRD 3.3 / 23.3: SQLite on device, an action queue processed in chronological order, "server wins for reference data", "latest
  timestamp wins for user entries, conflicts flagged", a pending-actions counter, and "same cow + same session + same date: warn user
  on sync". Sync scope is the last 30 days.
- `TECH_DEBT.md:182` (RAKHAL-108): any simplification of this such as silent last-write-wins is debt against PRD 23.3.
- Farms are on slow, intermittent mobile data (2G/3G, power cuts). Workers log milk twice a day in a shed with no signal.
- `apps/api` has **no** `/sync/*` routes and no delta-pull support (no list DTO takes `updatedSince`; no tombstones).
- Cost rule (CLAUDE.md): no new infrastructure, no always-on jobs. D7 chose the smaller backend change.

### What the backend does today (verified in code, 2026-11-15)

| Write | Route | Server behaviour on a replay or duplicate | Verdict |
|---|---|---|---|
| Milk log save | `POST /milk/log` (`MilkService.saveLog`) | `milkLogEntry.upsert` on unique `(cattleId, logDate, session)`. A replay with the same body rewrites the same values (harmless). A **different** body from another device silently overwrites the first, with no flag. A submitted entry that changes also re-posts the tank delta. | idempotent for identical replays; **silent last-write-wins** otherwise: debt against PRD 23.3 |
| Milk submit | `POST /milk/submit` | Only `submitted:false` entries are finalised, so a second call finds nothing and throws 400 "No new milk log entries to submit". No double count. | safe, but a replay looks like a failure |
| Sickness report | `POST /health/cases` (`createHealthCase`) | No natural key. Every call creates a row with a new `HC-xxxxx` code. | **a replay creates a duplicate case** |
| Task complete | `POST /tasks/:id/complete` | `getOrThrow`, then 400 "Task is already completed" if done. Otherwise update, audit, `maybeCreateNextRecurrence`. | a replay is a 400; a concurrent double call can spawn two recurrences |
| Existing key pattern | `Idempotency-Key` header on `POST /cattle/:id/events` (`AnimalEventWriteService.withIdempotency`) and reproduction routes; `reports` has its own column + request hash | Table `IdempotencyKey` unique `(farmId, key, endpoint)`: create the key, run, store `responseBody`; a replay returns it; a request in flight returns 409; a failed run deletes the key so a retry re-executes. | the pattern to generalise |
| Gaps in that pattern | | no request hash (same key + different body silently returns the old response); no user in the scope; no expiry (rows grow forever); the logic is copy-pasted per service | fix in WP8a |

## Decision

### 1. Architecture

Mobile owns an `expo-sqlite` database with three parts: **cache tables** (read data pulled from the server), an **outbox** (writes
waiting to be sent) and **meta** (schema version via `PRAGMA user_version`, last pull time per entity). The UI reads cache + a
visible overlay of pending outbox rows; it never reads the network directly for offline-capable screens. There is **no** generic
`/sync` endpoint: each queueable write is an ordinary REST route that accepts an `Idempotency-Key`.

### 2. What works offline (D6, proposed)

| Entity / action | Offline | Notes |
|---|---|---|
| Cattle list, detail summary, search | **read** (30-day cache window) | "last updated" shown; server wins |
| Sheds, tanks, task list, milk-log day grid | **read** | same |
| **Milk log save** (draft entries) | **queued write** | WP10 |
| **Milk submit** | **queued write**, depends on the save for the same date + session | WP10 |
| **Sickness report** (create case) | **queued write** | follows WP10 |
| **Task complete** | **queued write** | WP12 |
| Editing an entry that is already **submitted** | online-only | tank reconciliation is a server-side balance; not queued |
| Feed grid confirm (WP11), notifications read, reproduction events, sales, finance, settings, farm switch, anything not in this table | **online-only** | button disabled with an explanation, never a silent drop |
| Attachments / photos on a task completion | online-only in v1 | a binary upload queue is a separate decision |

Anything not listed as a queued write is online-only. Adding a queued write later requires an amendment to this ADR naming its dedupe
rule (section 3) and its conflict rule (section 6).

### 3. Idempotency key contract

- The client generates a UUIDv4 `local_id` when it creates the outbox row. That value is sent as `Idempotency-Key` on **every**
  attempt for that row (retries, app restarts, reboots). It is never regenerated, except for an explicit "use mine" resolution
  (section 6), which is a new logical write.
- The server stores the key in the existing `IdempotencyKey` table, scope `(farmId, key, endpoint)`, where `endpoint` is a stable route
  name (for example `milk.saveLog`). WP8a extracts `withIdempotency` into one shared helper (decorator or interceptor) and adds:
  1. **`requestHash`** (SHA-256 of the canonical body). Same key + same hash = replay; same key + different hash = **422**
     `IDEMPOTENCY_KEY_REUSED`, never the old response.
  2. **`userId`** stored for audit. Scope stays per farm.
  3. **Expiry:** rows older than 35 days are deleted by the existing nightly scheduler (no new job, no new wake-up). 35 > the 30-day sync
     scope, so a queued write that waited out a long offline period still dedupes.
  4. Replay response is the stored body with header `Idempotency-Replayed: true`, so the client can tell "done earlier" from "done now".
- The key is **optional** on the server for the web app (no behaviour change) and **required** by the mobile outbox.
- Per-route dedupe additions (the key alone is not enough where a route is not naturally safe):

| Route | Server change in WP8a |
|---|---|
| `POST /milk/log` | accept the key; add per-entry `baseUpdatedAt` conflict check (section 6) |
| `POST /milk/submit` | accept the key; a second call with a **new** key and nothing pending returns 200 `{totalCowsLogged: 0, alreadySubmitted: true}` instead of 400 |
| `POST /health/cases` | accept the key (this is the only dedupe: a case has no natural key) |
| `POST /tasks/:id/complete` | accept the key; completing an already-completed task returns **200 with the current task and `alreadyCompleted: true, completedBy, completedAt`** instead of 400; recurrence creation guarded so it runs once per completion |

### 4. Outbox schema (SQLite)

```
outbox(
  local_id        TEXT PRIMARY KEY,      -- UUIDv4, doubles as Idempotency-Key
  seq             INTEGER NOT NULL,      -- local monotonic counter, defines order
  farm_id         TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  endpoint        TEXT NOT NULL,         -- stable route name, e.g. milk.saveLog
  method          TEXT NOT NULL,
  path            TEXT NOT NULL,         -- /milk/log
  body            TEXT NOT NULL,         -- JSON, exactly what will be sent
  depends_on      TEXT,                  -- local_id that must be 'done' first (submit after save)
  status          TEXT NOT NULL,         -- pending | sending | failed | conflict | done
  queued_at       INTEGER NOT NULL,      -- device clock, display only
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER,               -- backoff, device clock
  last_error      TEXT,                  -- server message or 'network'
  conflict        TEXT                   -- JSON of the server's version when status = conflict
)
```

`done` rows are kept for 7 days (so the UI can show "saved"), then deleted. Schema changes are numbered migrations keyed on
`PRAGMA user_version`; WP8b ships a v1 to v2 migration test.

### 5. Sync loop

1. **Trigger:** app foreground, NetInfo reports connected, a queued write is created while online, or a manual "sync now". A
   connected NetInfo state is not trusted alone: one `GET /health` probe (short timeout) must succeed (captive portals, dead 2G).
2. **Order:** strictly by `seq`, one request in flight. Order is the local sequence, **not** the device clock (clocks drift, and a
   worker may change the phone's time). A row with `depends_on` waits until its parent is `done`.
3. **Push first, then pull.** Pull after the queue drains, so an older snapshot never overwrites what the device just wrote; the UI
   overlays still-pending rows on cached data.
4. **Outcome per request:**
   - 2xx (including a replay) -> `done`.
   - network error, timeout, 5xx, 429 -> keep `pending`, stop the loop, back off.
   - 401 -> `ApiClient` refreshes once (WP5c). If the session is gone, the loop pauses and the rows stay for the next sign-in.
   - conflict in the response (section 6) -> `conflict`; the loop **continues** with independent rows.
   - other 4xx (validation, 403, 404) -> `failed` with the server message; the loop continues with independent rows; a dependent row is
     marked `failed` ("depends on a failed entry"). Failed rows are never dropped silently.
5. **Backoff:** 5 s, doubling to a 15 min cap, with jitter; reset on a successful request or on an explicit user retry. One request at
   a time and the 20 s timeout keep 2G usable.
6. **Counter and glyphs** (PRD 23.3): a pill "3 pending" (WP8b `SyncStatusPill`), per-record icon + text + colour: saved / waiting /
   failed / needs review. The pill opens a sheet listing rows with Retry, Edit, Discard (discard needs a confirm).

### 6. Conflict rules (the PRD's "latest timestamp wins" is replaced by a version check)

The PRD says the latest **timestamp** wins. Device clocks are not trustworthy, and a timestamp rule is exactly the silent
last-write-wins that RAKHAL-108 forbids. This ADR therefore uses **"the server's version at the time you edited"**, and the owner
accepts that deviation by accepting the ADR. Server wins for reference data; for user entries the user decides.

| Write | Rule |
|---|---|
| **Milk log save** | Each entry carries `baseUpdatedAt`: the `updatedAt` of the row the device last saw, or `null` when the device saw none. If a row exists and (`updatedAt` is later than `baseUpdatedAt`, or `baseUpdatedAt` is `null`), the server **does not overwrite** that entry. The response is 200 with `saved`, and `conflicts: [{cattleId, server: {yieldL, updatedAt, updatedBy}, yours: {yieldL}}]`. The other entries in the same request are saved. WP8a must make a replay of the same key return the same split. This is PRD's "warn on sync". The device row becomes `conflict`. |
| Resolving a milk conflict | **Keep server's** (drop mine) or **Use mine**. "Use mine" is a new outbox row, new key, with `baseUpdatedAt` set to the server version just shown, and it writes an Activity Log line (PRD 23.3 "flagged in Activity Log"). |
| **Sickness report** | No conflict, only duplicates. Offline it cannot warn. Two devices can each create a case for one cow. Accepted, and the manager sees both in Sick Bay. Not hidden or merged. |
| **Task complete** | Server returns `alreadyCompleted` with who and when (section 3). The client treats it as **resolved**, not an error: "Already done by Karim at 6:10". |
| **Reference data** (cattle, sheds, tanks, task list) | Server wins on pull; never pushed from the device. |

`MilkLogEntry.updatedAt` exists (`@updatedAt`, verified in `prisma/schemas/milk/milk.prisma`), so the version check needs no schema change.
There is **no `updatedBy`** (only `createdBy`): WP8a adds a nullable `updatedBy` (small migration) so the conflict can say who changed the
row; until then the response omits it and the UI shows only the time.

### 7. Pull (read cache)

- v1 has **no delta endpoint** (D7). WP8b pulls the 30-day working set with the **existing** list routes, paginated, and replaces
  the cache table inside one SQLite transaction. Rows that disappear from the response are removed (this is the tombstone). A 500-animal
  farm is a few hundred KB; measure on a 2G profile before adding `updatedSince`.
- A delta pull (`updatedSince` + soft-delete visibility on `GET /cattle`, tasks, sheds) is a follow-up, started only if the measured
  full pull is too slow or too costly. It must be added per route and keep the cache replace path as a fallback.
- Pull order: sheds, cattle, tanks, tasks, then the milk-log grid for each day in the window. A failed entity keeps its previous cache;
  there is no partial wipe.
- The 30-day window applies to milk-log days and closed tasks; cattle and sheds are the full active herd (needed for tag search).

### 8. Ownership, security, session

- Every outbox row stores `farm_id` and `user_id`. The loop sends a row only when the signed-in user and active farm match. After a
  **farm switch**, other-farm rows stay queued and are shown as "waiting for <farm name>". They are never sent with the wrong token
  (the API ignores `farmId` in bodies anyway; the token decides).
- **Sign out** with unsent rows asks first: "N entries are not sent. Signing out discards them." Confirm discards them and clears the
  cache. A **revoked session** keeps the rows; the same user signing in again resumes the queue; a different user clears them.
- SQLite holds farm data unencrypted at rest on the device, protected by Android app sandboxing. This matches the access snapshot in
  AsyncStorage. No tokens are stored in the database (those stay in SecureStore). Revisit if the owner requires at-rest encryption.
- Photos are not queued (section 2), so no file path or upload credentials live in the outbox.

### 9. Testing and acceptance

Per the plan: queue survives app kill and reboot; order preserved; a failure of row 2 does not lose row 3; backoff does not hammer;
v1 -> v2 migration; failed writes are never dropped. WP8a e2e per route: replay -> same result, one row; same key + different body -> 422;
cross-farm key reuse -> independent; milk conflict -> `conflicts[]` and the server value unchanged; task complete twice -> 200 both times;
expiry job deletes only rows older than 35 days.

## Consequences

- WP8a is smaller than the `/sync` alternative (four routes plus one shared helper and one migration) and keeps web behaviour unchanged.
- The mobile engine is generic (outbox + sender), but each queueable write needs its own server dedupe note: that is the cost of D7.
  The ADR makes "online-only" the default so no write is queued by accident.
- Milk-log save gains a partial-success response. The web client ignores the new fields; the generated mobile types show them.
- Two devices creating the same sickness case offline will produce two cases. This is a known gap, chosen over adding a fuzzy server-side
  merge.
- The clock deviation from PRD 3.3 is explicit and needs owner acceptance.

## Alternatives rejected

- **`POST /sync/push` + `GET /sync/pull`** (D7, not chosen for now): one engine and true delta pull, but a large new backend surface
  (cursors, tombstones, per-entity mappers) before any mobile screen can ship.
- **Last-write-wins by timestamp:** simple, but silently loses a worker's entry, and device clocks are unreliable. Forbidden by RAKHAL-108.
- **React Query persistence on AsyncStorage:** no ordered, transactional queue and no fast local search (plan section 4).
- **Queue every write:** large blast radius (finance, sales, reproduction) without a conflict rule for each.

## Open points for WP8a / WP8b

1. Add `MilkLogEntry.updatedBy` (nullable) and fix the shape of the per-entry conflict response with the generated OpenAPI types.
2. Measure a full pull on a seeded 500-animal farm over a throttled connection; add delta only if needed.
3. Decide the retention for `done` outbox rows (7 days proposed) and a cap on the outbox size (proposed 500 rows, then block new queued
   writes with a message).
4. Owner: accept the D6 scope (section 2) and the version-check deviation from PRD 3.3 (section 6).
