# Frontend — In-Flight Board (live concurrency lock)

> **Multiple agents work this repo in parallel.** Read this FIRST, claim BEFORE editing, stay in your lane.
> Same protocol as the backend board (`D:\Projects\Rakhal\docs\IN_FLIGHT.md`) — this board covers
> `Repos/rakhal-consumer-frontend` only.

## Protocol
1. **Before starting** — read Active Claims; pick a ticket whose files/lane don't overlap any active row.
2. **Claim** — add a row *before* editing anything.
3. **Stay in your lane** — a ticket's lane is its `features/<x>/**` + `app/(app)/<x>/**` folders. Never edit
   another active row's files.
4. **Hot shared files** (append-only, minimal-diff, **re-read immediately before each edit**):
   `app/globals.css` (tokens) · `components/ui/**` · `components/shared/**` · `components/layout/**` ·
   `lib/**` · `i18n/messages/*.json` · `types/api.ts` · `package.json` · the docs in `docs/` ·
   RFE numbering in `PROJECT_PROGRESS.md`.
   Need a new shared component/util mid-ticket? Add it as a **new file**, note it in your claim row, never
   rewrite an existing shared file another lane may be using.
5. **i18n merge discipline:** add your keys namespaced by feature (`"cattle": { … }`) at the END of the
   feature's block — JSON conflicts are the #1 parallel-agent hazard here.
6. **Phase 0 (RFE-001…010) is NOT parallel-safe** except 006/007/009/010 after 003+004 land. One agent per
   foundation ticket, sequenced per the dependency graph.
7. **When done** — gate green (DoD in `ARCHITECTURE.md` §8), move row to Recently Done, update
   `PROJECT_PROGRESS.md` + `CURRENT_STATE.md`.

## 🔒 Active Claims

| Agent | Ticket | Lane (file globs) | Started | Status |
|-------|--------|-------------------|---------|--------|
| agent-fe-1 | RFE-001…005 (Phase 0, sequential, exclusive) | root config, app/**, components/**, lib/**, i18n/**, providers/**, types/** | 2026-07-09 | claimed |

## 🟢 Recently Done (pending commit)

| Ticket | Notes |
|--------|-------|
| — (knowledge base created 2026-07-09) | docs/ARCHITECTURE.md, DESIGN_SYSTEM.md, PROJECT_PROGRESS.md, this board, CURRENT_STATE.md, CLAUDE.md |
