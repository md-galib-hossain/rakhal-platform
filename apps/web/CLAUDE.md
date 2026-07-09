@AGENTS.md

# Rakhal Consumer Frontend — Claude Code memory (auto-loaded)

Next.js 16 (App Router) + React 19 + Tailwind v4 web app for **Rakhal** (dairy-farm SaaS, Bangla-first,
currency ৳). Consumes the NestJS backend at `../rakhal-backend` via `/api/v1` (customer surface only).
**Scale level: MS. Do not redesign — follow the established plan.**

## ⚠️ Parallel agents — read FIRST
**`docs/IN_FLIGHT.md` is the live concurrency lock.** Claim your ticket there before touching anything;
stay out of files another active row claims. Hot shared files (tokens/`globals.css`, `components/**`,
`lib/**`, `i18n/messages/*`, `package.json`, docs) are append-only + re-`Read` before each `Edit`.

## On a fresh start, read in order
1. `docs/IN_FLIGHT.md` — who's doing what right now
2. `docs/CURRENT_STATE.md` — snapshot + next task
3. `docs/PROJECT_PROGRESS.md` — ticket board **(source of truth — claim an RFE ticket)**
4. `docs/ARCHITECTURE.md` — stack, folder rules, API/auth contract, perf budgets, **Definition of Done**
5. `docs/DESIGN_SYSTEM.md` — tokens, component inventory, **Figma access protocol**

Engineering law (outranks preferences): `D:\Projects\Templates\02-FRONTEND-WEB-ENGINEERING-FRAMEWORK.md`
+ `04-UNIVERSAL-ENGINEERING-RULES.md`. Backend spec: Swagger `http://localhost:3000/api/docs` >
`D:\Projects\Rakhal\docs\Rakhal_API.md` > `Rakhal_PRD_v3_Complete.md`.

## Hard rules (violations = review-blockers)
- **Never guess API shapes** — check Swagger/the API doc; unclear → stop and note it in PROJECT_PROGRESS "gaps" table.
- All fetches through `lib/api/client.ts` via the feature's `api.ts`; **cursor** pagination (not page numbers);
  no `farmId` in bodies; tokens never in localStorage.
- Server Components by default; `'use client'` only at interactive leaves with a justification comment.
- Semantic tokens only (no raw hex); components from `components/ui|shared` — search before creating.
- Every data view: loading + error + empty + success states.
- Every string in `i18n/messages/{bn,en}.json` — `bn` is the default locale.
- Permissions via `<Can I="resource.action">` — never role string comparisons.
- Forms: react-hook-form + zod in `schemas.ts`, server 422 details mapped to fields, pending states.
- **Lighthouse 100 mandate**: `next/image`, `next/font`, dynamic-import heavy components, route JS ≤170KB gz,
  a11y always (see `ARCHITECTURE.md` §7).
- Next 16 APIs differ from training data — read `node_modules/next/dist/docs/` when unsure (per AGENTS.md).

## Done = all green
`pnpm lint` + `pnpm typecheck` + `pnpm build` + `pnpm test` (+ Playwright for auth/money/critical flows) +
both locales render + docs updated (`PROJECT_PROGRESS.md`, `CURRENT_STATE.md`) + IN_FLIGHT row released.
Full DoD: `docs/ARCHITECTURE.md` §8.
