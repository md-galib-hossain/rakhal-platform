# ADR-005: Native mobile app is `apps/mobile` (React Native + Expo), built inside this monorepo

Status: **proposed** (owner direction 2026-11-10: "React Native Expo, like BusinessOS"). Needs owner sign-off on
decisions 4 and 5 before the scaffold starts.

## Context

- Rakhal's mobile app is planned as offline-first React Native (PRD). The existing `rakhal-app` is a Flutter
  prototype (1 commit) and is superseded by this decision.
- `D:\Projects\businessos` already runs `apps/mobile` (Expo Router, `expo-secure-store`, `expo-sqlite`,
  `@react-native-community/netinfo`) in a pnpm workspace, with a `metro.config.js` that watches the monorepo
  root. It is the working reference.
- Differences from BusinessOS that matter here: BusinessOS mobile is Expo 52 / React 18.3.1 / RN 0.76 and
  consumes `@businessos/shared` from `dist`. This repo's web apps are Next 16 / React 19.2.4, and packages are
  source-exported (ADR-002).

## Decisions

1. **The mobile app is born in the monorepo.** There is no separate mobile repository, so nothing to migrate
   later. It starts after M4 (typed contracts exist), independent of the web import (M1-M5).
2. **Current stable Expo SDK at scaffold time, React 19-based.** Do not copy BusinessOS's Expo 52 / React 18
   versions. React is pinned **per app** (web and mobile each declare their own); no root-level React. The exact
   SDK/RN/React versions are recorded in the scaffold PR after checking Expo's compatibility table that day.
3. **Packages are source-exported, never `dist`.** Metro compiles TypeScript from `workspace:*` packages; Next
   uses `transpilePackages`. This avoids the stale-`dist` trap BusinessOS hit.
4. **Sharing rules.**
   - Shared with mobile: `@rakhal/api-client` (generated from OpenAPI, M4), `@rakhal/validation` (zod),
     `@rakhal/domain` (pure TS: feed DM/CP/ME math, units, money, date rules), design tokens as plain data.
   - **Not** shared: `@rakhal/ui` (radix + Tailwind, web only). Mobile owns `apps/mobile/src/components`.
   - A package is created only when it has two consumers; mobile is the second consumer for `validation` and
     `domain`, so they may be created now.
5. **Offline sync gets its own ADR before any offline screen** (SQLite write queue, client-generated idempotency
   keys, conflict rule, what is read-only offline). The backend must accept idempotency keys on mobile-written
   endpoints; that is a backend ticket, claimed in the backend `IN_FLIGHT.md`.
6. **Auth is direct-to-API with tokens in `expo-secure-store`** and client-side refresh. There is no BFF cookie
   layer (that is a web-only pattern). The farm context still comes from the token (`FarmContextGuard`); no
   `farmId` in bodies.
7. **Native builds run on EAS, not turbo.** `turbo run build` stays web-only. Mobile CI is path-filtered:
   `typecheck`, `lint`, unit tests. No device builds on PRs.
8. **Flutter `rakhal-app` is archived, not migrated.**

## Consequences

- Positive: one toolchain for all TypeScript; one typed contract for web and mobile; no second migration.
- Negative: two React majors may coexist if Next and Expo drift; Metro + pnpm needs a tested setup; EAS adds a
  paid/quota dependency to evaluate against the cost rule (CLAUDE.md: ask scale before cost-bearing infra).
- Revisit: after the first offline screen ships, review whether `domain` and `validation` earned their place.

## Alternatives rejected

- **Separate mobile repo.** Recreates the duplicated-contract problem the monorepo exists to remove.
- **Share `@rakhal/ui` via react-native-web or Tamagui.** Large rewrite of a working web UI for a UI-sharing win
  that does not outweigh the risk; revisit only with evidence.
- **Keep Flutter.** Splits language and contracts; contradicts the owner's direction.
