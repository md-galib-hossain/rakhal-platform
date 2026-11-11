# WP2 - Expo scaffold + theme/locale/typography: architecture and implementation spec

Status: spec for Codex. Author: Structa (Software Architect), 2026-11-11. Spec only: no installs, no app code, no lockfile change
were made while writing it. Scope is WP2 of `docs/mobile/ux-brand-plan.md` section 4 ("Theme provider and typography"), plus the
Expo scaffold it needs to run, plus the new `@rakhal/domain` package. **No WP3 components, no navigation tabs, no API calls, no auth,
no offline.**

Legend: **[V]** verified in this session (npm registry metadata/tarballs, files read, commands run). **[A]** assumed or inferred;
Codex must prove it with the "verify-first" checks in section 7 before building on it.

---

## 0. Decisions in one screen

| # | Decision | Status |
|---|---|---|
| D1 | Expo SDK **58** (`expo@58.0.23`), React Native **0.88.1**, React **19.3.0** (exact) | [V] |
| D2 | `@rakhal/domain` is a new **source-exported** pure-TS package: no build step, no `dist`, zero dependencies, **no `Intl`** | decision |
| D3 | Money/number/date formatting is **hand-written, Intl-independent, golden-tested**. Hermes `Intl` is not relied on | decision; Hermes gap [A] |
| D4 | Tokens stay in `apps/mobile/src/theme` (Q4 = "later"). No `@rakhal/tokens` package in WP2 | decision |
| D5 | **No root `.npmrc` change, no `node-linker=hoisted`.** pnpm isolated layout stays. No custom `metro.config.js` / `babel.config.js` at first | decision; Metro behaviour [V in source], end-to-end [A] |
| D6 | Theme/locale persistence: `@react-native-async-storage/async-storage@2.2.0` (SDK-pinned). `expo-secure-store` is reserved for tokens (X2), not installed in WP2 | decision |
| D7 | Test runners: keep `node --test` for pure TS (domain, theme logic); add `jest-expo` + `@testing-library/react-native` **only** for `src/**/*.test.tsx` | decision |
| D8 | No Reanimated, no Gesture Handler, no NativeWind, no icon library in WP2 | decision |
| D9 | Two React minors will coexist (admin 19.2.4, mobile 19.3.0). Same major; isolated by pnpm per importer | [V] |

---

## 1. Version matrix

Source: `npm view` on the registry and `bundledNativeModules.json` extracted from the `expo@58.0.23` tarball (the file `expo install`
uses to pick SDK-compatible versions). Date of lookup 2026-11-11. Registry dist-tags: `latest` = 58.0.23 (sdk-57 = 57.0.32,
next = 58.0.11, canary = 58.0.0-canary).

### 1.1 Mobile app dependencies (WP2)

| Package | Version to pin | Why | Status |
|---|---|---|---|
| `expo` | `~58.0.23` | current stable SDK; engines `^22.13 \|\| ^24.3 \|\| ^26 \|\| >=27` (CI Node 24 ok) | [V] |
| `react-native` | `0.88.1` | SDK 58 pin (`bundledNativeModules`) | [V] |
| `react` | `19.3.0` (exact, no caret) | SDK 58 pin; `react-native@0.88.1` peer is `react ^19.3.0`, so 19.2.4 **cannot** satisfy it | [V] |
| `expo-router` | `~58.0.30` | file-based routing, entry `expo-router/entry` | [V] |
| `expo-font` | `~58.0.11` | `useFonts` | [V] |
| `expo-splash-screen` | `~58.0.13` | hold splash until fonts + prefs ready | [V] |
| `expo-status-bar` | `~58.0.4` | theme-aware status bar | [V] |
| `expo-constants` | `~58.0.15` | required peer of expo-router | [V] |
| `expo-linking` | `~58.0.16` | required peer of expo-router | [V] |
| `@expo/metro-runtime` | `~58.0.17` | required (non-optional) peer of expo-router | [V] |
| `react-native-screens` | `~4.30.1` | required peer of expo-router (`^4.30.1 \|\| ^5.0.0-alpha.3`) | [V] |
| `react-native-safe-area-context` | `~5.11.1` | required peer of expo-router (`>=5.4.0`) | [V] |
| `@react-native-async-storage/async-storage` | `2.2.0` | SDK 58 pin. npm `latest` is 3.1.1; **do not take it**, it is not the SDK-tested version | [V] |
| `@expo-google-fonts/inter` | `0.4.2` | font data, see 1.3 | [V] |
| `@expo-google-fonts/noto-sans-bengali` | `0.4.4` | font data, see 1.3 | [V] |
| `@rakhal/domain` | `workspace:*` | new package, section 2 | - |
| `@types/react` (dev) | `~19.3.0` | SDK 58 template/pin; the lockfile already resolves `@types/react@19.3.0` for admin, so it dedupes | [V] |
| `typescript` (dev) | `~5.9.3` (unchanged from WP1) | lockfile already has 5.9.3; npm `latest` is 7.0.2, **not adopted**, out of scope | [V] |
| `@types/node` (dev) | `^24` (unchanged) | WP1 scripts run on Node 24 | [V] |
| `eslint` (dev) | `^9` | same as admin; npm `latest` is 10.14.0, not adopted (`@rakhal/config` peer is `^9`) | [V] |
| `@rakhal/config` (dev) | `workspace:*` | shared ESLint boundary rules, tsconfig base | [V] |

Not installed in WP2 (recorded so later WPs do not re-research): `expo-secure-store ~58.0.2` (X2 tokens), `expo-sqlite ~58.0.15` and
`@react-native-community/netinfo 12.0.1` (X3 offline), `expo-localization ~58.0.5` (not needed: default locale is `bn`, not the device
locale), `expo-system-ui ~58.0.7`, `react-native-reanimated 4.7.1` + `react-native-worklets 0.13.0`, `react-native-gesture-handler ~3.3.0`
(npm latest is 3.5.0; take the SDK pin). `react-dom` / `react-native-web` are not installed: native targets only.

### 1.2 Test and lint dev dependencies (WP2)

| Package | Version | Why | Status |
|---|---|---|---|
| `jest-expo` | `~58.0.14` | the supported RN/Expo Jest preset (peers: `jest ^29 \|\| ^30`, `@react-native/jest-preset ^0.88.1`) | [V] |
| `jest` | `^30.5.2` | latest 30.x; jest-expo's own deps are Jest 30 | [V] |
| `@react-native/jest-preset` | `0.88.1` | required peer of jest-expo (Jest preset moved out of `react-native`) | [V] |
| `@testing-library/react-native` | `^14.1.0` | v14 peers: `react >=19`, `react-native >=0.78`, `test-renderer ^1.0.0`, `jest` optional | [V] |
| `test-renderer` | `1.3.0` | RNTL 14 peer; jest-expo pins exactly 1.3.0, pin the same so pnpm does not install two (npm latest 1.3.1) | [V] |
| `@jest/globals` | `^30.5.2` | typed `describe/it/expect` imports; avoids `@types/jest` clashing with `node:test` | [V] |

Why `jest-expo` and not "the lightest runner": React Native sources contain Flow syntax and native-module imports; Vitest (used by admin)
cannot load them without a hand-written mock layer (BusinessOS did exactly that with `test/react-native-mock.ts`, which tests a mock, not the
component). `jest-expo` is the only supported path to render real RN components. To keep its cost small it is scoped to component tests
only; everything pure stays on `node --test`, which already runs the WP1 suite (73 tests) in under a second with zero extra dependencies.

### 1.3 Fonts - real export names [V, extracted from the tarballs]

Names in `src/theme/tokens.ts` `fontFamily` (`Inter_400Regular`, `NotoSansBengali_600SemiBold`, ...) **match the real exports exactly** for all
four weights of both families (`400Regular`, `500Medium`, `600SemiBold`, `700Bold`). WP1's assumption held.

Facts that change how WP2 must import them:

1. The package barrel (`@expo-google-fonts/inter`) `require()`s **all 18** Inter TTFs (8 MB unpacked). Importing from the barrel would ship them
   all. **Rule: import per-weight deep paths only**, e.g. `@expo-google-fonts/inter/400Regular` (each folder has an `index.js` exporting the
   one `require`) [V].
2. TTF sizes [V]: Inter 400/500/600/700 are 342/343/344/344 KB; Noto Sans Bengali are 141/141/142/141 KB. Three weights per family
   (regular/medium/semibold, the only weights `typeScale` uses) is about 1.5 MB of fonts; adding bold is +0.7 MB.
   **Load 400/500/600 only in WP2** (open decision O8); `bold` exists in tokens but no role uses it.
3. **Glyph coverage, checked by parsing each font's `cmap` [V]:** Noto Sans Bengali contains Basic Latin letters, Latin digits, `, . - + % : /`
   and the taka sign `U+09F3` (`৳`) and Bangla digits. **Inter does NOT contain `৳` (U+09F3), Bangla digits, ZWJ/ZWNJ, or the Bangla danda.**
   Consequences:
   - In `bn`, render everything in Noto Sans Bengali (it also covers Latin names and digits). No fallback needed.
   - In `en`, any string containing `৳` rendered in Inter falls back to an unpredictable system font for that one glyph (and Android has no
     per-family fallback chain in RN). **Policy: the `Text` primitive resolves the font per string, `script="auto"`: if the string contains any
     U+0980-U+09FF codepoint, use the Bengali family, else the locale's family.** The detector is a pure function in `@rakhal/domain`.
     Mixed spans (money in Bengali font inside an Inter sentence) are a WP3 refinement (O8).

---

## 2. Package layout

### 2.1 Monorepo after WP2 (new items marked +)

```
rakhal-platform/
  .npmrc                      (unchanged: auto-install-peers=true)
  pnpm-workspace.yaml         (unchanged: apps/*, packages/*)
  tsconfig.base.json          (unchanged)
  turbo.json                  (unchanged)
  .github/workflows/ci.yml    (unchanged by WP2; WP1's node 24 line is already pending)
  packages/
    config/                   (unchanged)
    ui/  admin-api-client/    (unchanged; mobile must not import @rakhal/ui)
  + domain/                   @rakhal/domain (2.3)
  apps/
    admin/                    (unchanged)
    mobile/                   @rakhal/mobile (2.2)
```

### 2.2 `apps/mobile` (Expo app)

```
apps/mobile/
  package.json              (edit: add "main": "expo-router/entry", deps 1.1/1.2, scripts section 5; keep "type": "module")
  app.json                  (+ static; no ios.bundleIdentifier / android.package yet, see O12)
  tsconfig.json             (edit, section 4)
  eslint.config.mjs         (+ section 5)
  jest.config.cjs           (+ section 4.3)
  .gitignore                (+ .expo/  dist/  expo-env.d.ts)
  app/                      (+ Expo Router entry; routes only, no logic)
    _layout.tsx             root: splash hold, providers, <Slot/>, StatusBar
    index.tsx               dev: <Redirect to="/dev/gallery"/>; non-dev: minimal placeholder screen (no WP3/nav)
    dev/gallery.tsx         DEV-only gallery route (guarded by __DEV__ inside; production build renders <Redirect href="/"/>)
  assets/                   (+ only if a splash/icon file is needed; light logo/icon assets are still open, see O12)
  src/
    theme/                  (WP1, existing: tokens.ts, mobile-only.ts, divergences.ts, known-gaps.ts)
    + theme/fonts.ts        deep-import font map -> expo-font keys (the only file that imports @expo-google-fonts)
    + theme/font-scale.ts   pure cap table by TextRole + effectiveScale() (no RN imports)
    + storage/prefs.ts      PrefStorage interface, parse/serialize, asyncStorage adapter (pure logic + 1 adapter)
    + providers/ThemeProvider.tsx
    + providers/LocaleProvider.tsx
    + providers/AppProviders.tsx          composes Locale + Theme + TextScale
    + providers/useAppReady.ts            fonts loaded/failed AND prefs hydrated
    + components/primitives/Text.tsx      Text + Heading (Heading re-exported from same file or Heading.tsx)
    + components/primitives/TextScaleContext.tsx   dev/test override of effective font scale
    + i18n/messages.ts      tiny typed {bn,en} dictionary for the gallery (no i18n library in WP2)
    + i18n/useFormat.ts     hook binding @rakhal/domain formatters to current locale + digit system
    + types/expo-env.d.ts   `/// <reference types="expo/types" />` committed, so CI typecheck does not depend on `expo start`
  scripts/ test/            (WP1, existing; keep running under plain Node)
  + src/**/*.test.tsx       Jest component tests (colocated; matched only by jest.config.cjs)
  + test/*.test.ts          additional node tests: prefs, font-scale, app.json-vs-tokens (4.4)
  vendor/                   (WP1, unchanged)
```

`src/components/primitives` holds only `Text`, `Heading`, `TextScaleContext` in WP2. `src/components` otherwise stays empty for WP3.

### 2.3 `packages/domain` (`@rakhal/domain`, new, pure TS)

```
packages/domain/
  package.json    name @rakhal/domain, private, "type":"module", exports {".": "./src/index.ts"}, no dependencies
                  devDependencies: @rakhal/config workspace:*, @types/node ^24, typescript ~5.9.3, eslint ^9
                  engines node >=24 (matches mobile; Node type-stripping runs its tests)
                  scripts: lint "eslint .", typecheck "tsc --noEmit", test "node --test \"test/*.test.ts\""
  tsconfig.json   extends @rakhal/config/tsconfig.base.json; allowImportingTsExtensions, erasableSyntaxOnly,
                  lib ["esnext"], types ["node"], include ["src","test"]; NO jsx, NO dom lib
  eslint.config.mjs   typescriptBase + boundaryRules from @rakhal/config/eslint (+ ban of imports of react*, @rakhal/ui)
  src/index.ts        re-exports
  src/locale.ts       Locale = 'bn' | 'en'; DEFAULT_LOCALE='bn'; DigitSystem = 'latn' | 'beng'; DEFAULT_DIGITS='latn';
                      isLocale/parseLocale(raw)->Locale|undefined; TextScript = 'latin' | 'bengali';
                      scriptForLocale(locale); scriptOfText(text, fallback) (any U+0980-09FF => 'bengali')
  src/digits.ts       toBanglaDigits(s); applyDigits(s, digits)   // 0-9 -> U+09E6..U+09EF; ',' '.' '-' unchanged
  src/number.ts       roundHalfExpand(decimalString, fractionDigits); groupIndian(intString); formatNumber(value, opts?)
  src/money.ts        formatMoney(amount, opts?)  // '৳' prefix, lakh/crore, 0 decimals default
  src/date.ts         DHAKA_OFFSET_MINUTES = 360 (Bangladesh has no DST); dhakaParts(date); month/weekday tables (bn+en);
                      formatDate(input, { locale, style?, digits? }), formatDateTime(input, { locale, style?, digits? }),
                      farmDayKey(date) -> 'YYYY-MM-DD'   (options-object signature as built; supersedes the earlier positional form)
  src/golden-vectors.ts   exported data: [{ fn, args, expected }]  used by node tests AND by the in-app self-test (4.2)
  test/*.test.ts      number, money, digits, date, locale, golden, differential-vs-Intl (Node-only oracle)
```

**Why a package and why now:** ADR-005 decision 4 already allows `domain` to be created now because mobile is the second consumer (web
`lib/format.ts` is the first logic source). Formatting must behave identically on web, admin, mobile and Node tests; one tested
implementation removes the "Hermes vs ICU" divergence class entirely.

**Source or compiled? Source-exported TypeScript, no build.** Justification per consumer:

| Consumer | Works because |
|---|---|
| Metro | `exports` points at `./src/index.ts`; Expo's Metro `sourceExts` include `ts`/`tsx`; the symlink `apps/mobile/node_modules/@rakhal/domain -> packages/domain` resolves inside Metro's auto-detected watch folders (section 3). Same pattern as `@rakhal/admin-api-client` today [V] and ADR-002/005 decision 3 |
| `node --test` | Node 24 strips types from `.ts`. It refuses `.ts` **inside `node_modules`**, but Node resolves the workspace symlink to its real path `packages/domain/src/...` (not under `node_modules`), so importing `@rakhal/domain` from `apps/mobile` tests works [A: Node's default realpath behaviour; prove in 7, check V3] |
| Next/admin (future) | `transpilePackages: ["@rakhal/domain"]`. Admin does not consume it in WP2 |

**Hard rules for `packages/domain` code (so every consumer works):**
1. Relative imports **must carry the `.ts` extension** (`from "./number.ts"`): Node type-stripping needs exact specifiers, Metro and Jest
   resolve explicit extensions fine. Only `erasableSyntaxOnly` syntax: no `enum`, no `namespace`, no constructor parameter properties.
2. No `Intl`, no `toLocaleString`, no `toFixed`, no `Date.toLocale*`/`Date` local-time getters (use UTC getters + fixed +06:00 offset), no `process`,
   no DOM, no React, no RN, no path aliases, no runtime dependencies.
3. `import type` for types. No default exports. No side effects at import.
4. **Admin follow-up (not WP2, needs approval O6):** when admin first imports `@rakhal/domain`, its tsconfig must add `allowImportingTsExtensions`
   (already `noEmit`), otherwise `tsc` raises TS5097 on the package's `.ts` specifiers. Mobile/domain tsconfigs set it from day one.

### 2.4 Where tokens stay; Q4

Tokens remain in `apps/mobile/src/theme` (WP1, drift-checked against the vendored `web-globals.css`). **Q4 position: later, not in WP2.**
Reasoning: a package needs two consumers (ADR-005 decision 4); the second consumer would be a CSS generator for web/admin, which does not
exist and would require editing `packages/ui` and the web repo (out of bounds, ux-brand-plan 2.3). WP1's drift check already guards the real
risk. Extraction later is mechanical because `tokens.ts` and `mobile-only.ts` import nothing from React Native. Keep that true: **theme files must not
import `react-native`, `expo-*` or React.** `@rakhal/domain` must never import tokens (dependency direction: mobile -> domain, theme -> nothing).

---

## 3. Metro + pnpm workspace

### 3.1 Findings

- **Expo SDK 58 configures monorepos automatically [V in source].** `@expo/metro-config@58.0.21` `getDefaultConfig(projectRoot)` computes
  `watchFolders` (workspace root `node_modules` + every workspace package directory, found from the workspace globs) and
  `resolver.nodeModulesPaths` (`apps/mobile/node_modules` + root `node_modules`) via `getMetroServerRoot`/`getWatchFolders`/`getModulesPaths`.
  A hand-written `watchFolders` like BusinessOS's `config.watchFolders = [monorepoRoot]` is therefore not required; it also makes Metro
  watch the entire repo including `apps/admin/.next`. Automatic detection can be disabled with `EXPO_NO_METRO_WORKSPACE_ROOT` (do not set it).
- Whether detection understands `pnpm-workspace.yaml` (as opposed to only `package.json` `workspaces`) is [A, very likely: it uses the standard
  workspace-root resolver]. Verify-first check V2.
- **pnpm isolated layout works with Metro [partly V].** BusinessOS (`D:\Projects\businessos`) installs with pnpm's default isolated layout
  (no `.npmrc` at its root, `pnpm-workspace.yaml` only has `overrides`) and has a working `apps/mobile` with `dist-web`/`.expo` build artefacts.
  Its `metro.config.js` is the older hand-rolled pattern (`watchFolders`, `nodeModulesPaths`, `disableHierarchicalLookup=false`, an
  `extraNodeModules` alias for its shared package, a `.js -> .ts` resolver shim, expo-sqlite web stub). None of those is needed here: the
  `.js -> .ts` shim exists because BusinessOS source uses `.js` import specifiers; ours uses `.ts`.
- **Correction to ADR-005 context [V]:** it says BusinessOS mobile is "Expo 52 / React 18.3.1 / RN 0.76". Its current `package.json` is
  `expo ~58.0.23`, `react 19.3.0`, `react-native 0.88.1`, `expo-router ~58.0.30`, `react-native-screens ~4.30.1`, i.e. exactly the stack
  chosen here. It is therefore a closer reference than the ADR implied (see the amendment at the end).

### 3.2 Decision

1. **Start with no `metro.config.js` and no `babel.config.js`.** Expo supplies both defaults (`babel-preset-expo` is applied by Expo's
   transformer when no Babel config exists). Add one **only if** a verify-first check fails, and then as `metro.config.cjs`/`babel.config.cjs`
   (the package is `"type": "module"` because WP1's Node scripts require it; a `.js` config would be loaded as ESM and `require` would fail).
   If a custom Metro config becomes necessary, keep it to: `const config = getDefaultConfig(__dirname); module.exports = config;` plus the single
   minimal addition proven needed. Do **not** copy BusinessOS's `watchFolders`, alias, or resolver shims.
2. **No `.npmrc` change at the repo root; no `apps/mobile/.npmrc`.** Do not set `node-linker=hoisted`. The 06-mobile-track X1 note about
   `apps/mobile/.npmrc` is not a usable lever: pnpm applies install-affecting settings such as `node-linker` from the **workspace root**, not
   from a package `.npmrc` [A, pnpm behaviour; confirm if ever needed]. A hoisted linker at the root would re-layout `node_modules` for
   admin and `@rakhal/ui` and is the highest-blast-radius option, so it is the last resort and needs owner approval (O3). If a specific package
   ever needs to be visible at the top, use a targeted `public-hoist-pattern[]=<pkg>` (a one-line root `.npmrc` addition, still owner-approved),
   not the hoisted linker. Native builds (EAS, `expo prebuild`) are out of WP2; Expo supports pnpm isolated installs on EAS [A].
3. Keep root `.npmrc` `auto-install-peers=true`. Impact: required peers not listed as dependencies are auto-installed; `expo`/`expo-router` mark
   their heavy peers (`react-dom`, `react-native-web`, `@expo/ui`, `expo-symbols`, reanimated, gesture-handler, `react-server-dom-webpack`, ...)
   **optional** [V], so they are not auto-installed. Explicitly listing every required peer (1.1) keeps the lockfile deterministic.
   `@expo/log-box` is a dependency of both `expo` and `expo-router`; add it only if pnpm warns of a missing peer.

### 3.3 Risk to `apps/admin` and isolation

| Risk | Why it could happen | Isolation / check |
|---|---|---|
| React duplicate / wrong version for admin | admin = `react 19.2.4` exact; mobile = `19.3.0` exact; both in one lockfile | pnpm resolves per importer; each importer links its own react. Check: `pnpm why react --filter @rakhal/admin` still shows only 19.2.4 and the `apps/admin:` importer block in `pnpm-lock.yaml` is byte-identical before/after (`git diff` limited to other importers, `packages:` and `snapshots:`) |
| `@rakhal/ui` peer `react: "19.2.4"` unsatisfied | would only bite if mobile depended on it | boundary test (WP1) + lint ban; never import it |
| Phantom hoisting changes | pnpm default `hoist=true` puts everything in `node_modules/.pnpm/node_modules` | unchanged setting; admin resolves only its own deps. No `public-hoist-pattern` change |
| Admin build regression | lockfile re-resolution bumps a shared transitive (e.g. `@types/react`, `typescript-eslint`) | compare `turbo run build typecheck lint test --filter=@rakhal/admin` before and after against the M0 baseline; any version drift in admin's resolved set is a blocker |
| Engines noise | root `engines.node >=20.9` vs Expo `^22.13 \|\| ^24.3` | warnings only (no `engine-strict`); CI is Node 24 (WP1 change). Do not edit root `engines` (owner, O1) |
| pnpm 10.0.0 blocks dependency build scripts by default | some transitive may want `postinstall` | if "Ignored build scripts" appears, record the names; do **not** add `onlyBuiltDependencies` without owner say-so (O1) |

---

## 4. TypeScript, Jest and the existing Node scripts

### 4.1 Constraint recap [V]

`apps/mobile/tsconfig.json` today: extends `../../tsconfig.base.json` (jsx `preserve`, `lib dom`), overrides `allowImportingTsExtensions`,
`types ["node"]`, `lib ["esnext"]`, `jsx "react-native"`, `erasableSyntaxOnly`; `include` is `src`, `scripts`, `test`. WP1 scripts and tests run as
`.ts` under Node 24 type-stripping with `import ... from './x.ts'` (even `src/theme/*.ts` do this).

### 4.2 Target `apps/mobile/tsconfig.json`

```jsonc
{
  "extends": ["../../tsconfig.base.json", "expo/tsconfig.base"],   // array form: later entries win
  "compilerOptions": {
    "allowImportingTsExtensions": true,   // WP1 + domain rule: relative imports carry .ts
    "erasableSyntaxOnly": true,           // keeps WP1 scripts runnable by Node type-stripping; also blocks enum/namespace
    "jsx": "react-jsx",                   // Expo/Babel automatic runtime (replaces "react-native")
    "lib": ["esnext", "dom"],             // TRY ["esnext"] first (RN ships its own globals); add "dom" only if RN/expo types need it
    "types": ["node", "jest"]             // see note
  },
  "include": ["app", "src", "scripts", "test", "jest.config.cjs"]
}
```

Notes:
- `expo/tsconfig.base` (read in the tarball [V]) supplies `moduleResolution: bundler`, `module: preserve`, `customConditions: ["react-native"]`,
  `allowJs`, `resolveJsonModule`, `jsx: react-jsx`, `target: ESNext`. The local overrides above restore WP1's two non-negotiables.
- `types`: do **not** add `@types/jest`. Component tests import from `@jest/globals` explicitly, so `types` stays `["node"]` and the global `test`/`describe`
  names of `node:test` and Jest can never collide. Final value: `["node"]`.
- `jsx`: WP1's `react-native` mode type-checks but does not match Babel's automatic runtime; `react-jsx` is what Expo templates use and requires
  `@types/react` (added). Prove with V4.
- `src/types/expo-env.d.ts` with `/// <reference types="expo/types" />` is committed so `tsc --noEmit` in CI does not rely on the generated `expo-env.d.ts`.
- Asset `require()` of fonts is only in `src/theme/fonts.ts`; `expo/types` types it.
- WP1 files must still typecheck unchanged; any necessary fix is behaviour-free and reported.

### 4.3 Jest config (`apps/mobile/jest.config.cjs`; `.cjs` because the package is ESM)

```js
module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/*.test.tsx"],           // node:test files in test/*.test.ts are NOT picked up
  transformIgnorePatterns: [ /* start from jest-expo's default, adapted for pnpm: see pitfall */ ],
};
```

Known pitfall [A, well-known]: under pnpm, real paths look like `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>`, which defeats the stock
negative-lookahead `transformIgnorePatterns`, so RN/Expo packages are not transpiled and Jest throws "Unexpected token" / Flow errors. The usual
fix is to allow an optional `.pnpm/<name>@<ver>/node_modules/` segment before the allow-listed package names (react-native, @react-native*, expo*,
@expo*, @expo-google-fonts, @testing-library). `@rakhal/domain` resolves to its real path outside `node_modules` and is transformed by default.
If Jest cannot parse TSX at all, add `babel.config.cjs` with `presets: ['babel-preset-expo']` (V5). Run with `--ci`; no watchman needed.

### 4.4 Coexistence rules between the two runners

- `node --test "test/*.test.ts"` keeps running WP1 + new pure tests. Those files **must not import RN, Expo, React or `src/providers`/`components`**.
  They may import `src/theme/*`, `src/storage/prefs.ts` (pure parts), `src/theme/font-scale.ts`, `@rakhal/domain`.
- `src/**/*.test.tsx` runs only under Jest and may import RN/Expo/React.
- **WP1 boundary test (`test/boundary.test.ts`) walks every `.ts/.tsx/.js/.json/.css/.md` file under `apps/mobile` (skipping `node_modules`, `.expo`,
  `dist`, `build`, `.turbo`) and fails on hex literals outside `tokens.ts`/`divergences.ts`/`mobile-only.ts`/`package.json`.** Two consequences:
  1. `app.json` must carry splash/background colours as hex (native config cannot read JS). Resolve with a **one-line allowlist addition for
     `app.json`** in `boundary.test.ts` **plus a new `test/app-config.test.ts`** asserting every colour in `app.json` equals the corresponding token
     (`colorsLight.sidebar` `#055640` for the splash, dark splash `colorsDark.sidebar` `#06301f`). Same single-source guarantee, no new literal source (O10).
  2. Component code must use token names only (`color="foreground"`), never literals; the shared ESLint `no-restricted-syntax` hex rule enforces it in
     `src` and `app` (ignored for `src/theme/**`, `scripts/**`, `test/**`, `vendor/**`).
- `jest.config.cjs`, `eslint.config.mjs` and any `*.cjs` config are scanned by that test: no hex in them.

---

## 5. Hermes `Intl` and the formatter decision

### 5.1 What was verified and what was not

Verified on this machine under **Node 24.21 (full ICU)**, not Hermes [V]:
- `new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(1250000)` -> `12,50,000`; `bn-BD-u-nu-latn` -> `12,50,000`; plain `bn-BD` -> `১২,৫০,০০০`
  (Bangla digits by default, so the `-u-nu-latn` extension is load-bearing); `-1234567` -> `-12,34,567`; `-0.4` -> `-0`; `2.5` -> `3`, `0.5` -> `1`
  (half away from zero); `12.35` with 1 fraction digit -> `12.4` (rounding acts on the shortest decimal string, not the binary value);
  `9007199254740991` -> `9,00,71,99,25,47,40,991`.

**Not verified (cannot be on this machine): Hermes behaviour.** [A] Hermes ships `Intl.NumberFormat`/`DateTimeFormat` backed by the platform
(Android: the device OS's ICU/`java.text`, iOS: Foundation), so output for `en-IN` grouping, the `-u-nu-latn` extension and `bn-BD` data depends on
OS version and device vendor, and ux-brand-plan 2.2 already flags it as a known gap. Statement for the record: **Hermes `Intl` is not
guaranteed to be sufficient for `৳12,50,000`; it must not be relied on.** Spec decision below removes the dependency instead of testing around it.

### 5.2 Decision: hand-written, Intl-independent formatter in `@rakhal/domain`

Required behaviour (all documented in code comments; golden vectors in `src/golden-vectors.ts`):

- `formatMoney(amount, { digits?: 'latn'|'beng', fractionDigits?: number = 0 })` -> `৳` + number; `locale` is not an input (money groups as lakh in both
  locales, ADR/web law); only digits vary. Web parity for negatives: `৳-1,234` (web concatenates `৳` + Intl output). O7 asks Forma to confirm or change to `-৳1,234`.
- Grouping: last 3 digits, then groups of 2, `,` separator, `.` decimal. Crore and beyond continue in 2s (`1,00,00,00,000`).
- Rounding: **half away from zero on the shortest round-trip decimal string** (`String(abs)`, expanding exponent notation manually), never `toFixed`
  or binary arithmetic. This matches Node's ICU for all vectors below including `12.35 -> 12.4`.
- Negative zero after rounding prints `0` (deliberate divergence from ICU's `-0`; documented, excluded from the differential test).
- Non-finite input: a placeholder string would be wrong for money, so **throw `RangeError`** for `NaN`/`Infinity`. Callers handle absence before formatting.
  Magnitudes above `Number.MAX_SAFE_INTEGER` throw `RangeError` (money is stored as integer taka/paisa upstream).
- Digits: Latin by default (product decision). `digits: 'beng'` maps `0-9` to `U+09E6-U+09EF` after grouping; separators unchanged.
- `formatNumber(value, { fractionDigits?, minFractionDigits?, digits? })`, same grouping and rounding. (Plain counts such as litres use lakh grouping, like web.)
- Dates: fixed `Asia/Dhaka` (UTC+06:00, no DST) by integer arithmetic on UTC time; month/weekday names from literal tables in `bn` and `en`; styles
  `short` (`11 Nov, 2026`-like, matching web `d MMM, yyyy`), `long`, plus `time`. No `Intl.DateTimeFormat`. Day-of-record helper `farmDayKey`.
  Digit mapping applies to dates the same way.

**Golden vectors (minimum set; Codex adds more, never fewer):**

| Call | Expected |
|---|---|
| `formatMoney(0)` | `৳0` |
| `formatMoney(7)` | `৳7` |
| `formatMoney(999)` | `৳999` |
| `formatMoney(1000)` | `৳1,000` |
| `formatMoney(12345)` | `৳12,345` |
| `formatMoney(99999)` | `৳99,999` |
| `formatMoney(100000)` | `৳1,00,000` |
| `formatMoney(1250000)` | `৳12,50,000` |
| `formatMoney(12345678)` | `৳1,23,45,678` |
| `formatMoney(123456789)` | `৳12,34,56,789` |
| `formatMoney(1000000000)` | `৳1,00,00,00,000` |
| `formatMoney(1234.49)` / `(1234.5)` | `৳1,234` / `৳1,235` |
| `formatMoney(99999.5)` | `৳1,00,000` |
| `formatMoney(0.5)` / `(2.5)` | `৳1` / `৳3` |
| `formatMoney(-1234567)` | `৳-12,34,567` |
| `formatMoney(-0.4)` | `৳0` |
| `formatMoney(1250000, {digits:'beng'})` | `৳১২,৫০,০০০` |
| `formatMoney(1250000.5, {fractionDigits:2})` | `৳12,50,000.50` |
| `formatNumber(1234567.891, {fractionDigits:3})` | `12,34,567.891` |
| `formatNumber(12.35, {fractionDigits:1})` | `12.4` |
| `scriptOfText('Milk ৳450','latin')` | `bengali` |
| `scriptOfText('Milk 450','latin')` | `latin` |

**Differential test (Node only, never run in production):** for ~2,000 deterministic pseudo-random values (fixed seed) plus boundary values, assert
`formatNumber`/`formatMoney` equals `new Intl.NumberFormat('en-IN', ...)` output (and the `bn-BD-u-nu-latn` form), excluding the documented
divergences (`-0`). This uses Node's ICU as an oracle and is the strongest evidence short of a device.

**On-device proof without a device test runner:** the gallery has a dev-only "Formatter self-test" button that runs every entry of
`goldenVectors` on the device's JS engine and shows pass/fail counts, next to an "Intl probe" row printing the engine's own
`Intl.NumberFormat('en-IN').format(1250000)`, `bn-BD`, and `-u-nu-latn` results (information only; production code never calls them). This gives Verity
Hermes-specific evidence on the Android emulator.

Why not a polyfill (e.g. `@formatjs/intl-numberformat` + locale data): it is a large dependency, needs per-locale data loading and still has
engine-specific edge cases, for a formatting surface of three functions with a closed spec.

---

## 6. WP2 work items for Codex (build order)

Each item lists files, then its done-when. Do them in order; commit at the boundaries marked **[commit]**. Items W2-1 and W2-2 deliberately precede the
big install so a small, reversible lockfile change lands first.

### W2-0 Preflight and approvals
Confirm owner decisions O1-O3 (section 11) are recorded. Record baselines: `pnpm install --frozen-lockfile` exit 0, `turbo run lint typecheck test` result,
`pnpm why react --filter @rakhal/admin` (19.2.4), a copy of the `apps/admin:` lockfile importer block. Done when baselines are pasted into the PR description.

### W2-1 `@rakhal/domain` [commit 1, small lockfile diff]
Files: everything under 2.3. TDD: write `test/*.test.ts` golden/differential tests first. Run `pnpm install` once (adds an importer entry only).
Done when: `pnpm --filter @rakhal/domain typecheck lint test` green; `grep -rn "Intl\|toLocale\|toFixed" packages/domain/src` empty (enforced by a test that scans
`src`, like WP1's boundary tests); `git diff pnpm-lock.yaml` contains only the new `packages/domain` importer (+ at most already-present resolved packages).

### W2-2 Expo scaffold + toolchain [commit 2, large lockfile diff]
Files: `apps/mobile/package.json` (add `"main": "expo-router/entry"`, dependencies 1.1, devDependencies 1.2, scripts below), `app.json`, `tsconfig.json`,
`eslint.config.mjs`, `jest.config.cjs`, `.gitignore`, `src/types/expo-env.d.ts`, `app/_layout.tsx` + `app/index.tsx` (a one-line placeholder), updated
`test/boundary.test.ts` allowlist entry and `test/app-config.test.ts`.

`app.json` (static): `name "Rakhal"`, `slug "rakhal"`, `scheme "rakhal"`, `version "0.0.0"`, `orientation "portrait"`, `userInterfaceStyle "automatic"` (**required**
so the OS reports dark mode and `Appearance.setColorScheme` works), `plugins: ["expo-router", ["expo-splash-screen", {"backgroundColor": <sidebar light>,
"dark": {"backgroundColor": <sidebar dark>}}], "expo-font"]`, `experiments: {}` (no typed routes in WP2: avoids generated `.expo/types` in `include`).
**No `ios.bundleIdentifier`, no `android.package`, no EAS `projectId`, no icon/splash image** until the owner decides identity (O12); Expo Go/dev does not need them.

Scripts in `apps/mobile/package.json` (keep existing ones):

```
"start":            "expo start",
"android":          "expo start --android",
"lint":             "eslint .",
"typecheck":        "tsc --noEmit",
"test:node":        "node --test \"test/*.test.ts\" && node scripts/check-token-drift.ts",
"test:components":  "jest --ci",
"test":             "pnpm run test:node && pnpm run test:components"
```

Done when: `pnpm install --frozen-lockfile` exit 0 on a clean clone; verify-first checks V1-V5 pass (section 7); `pnpm --filter @rakhal/mobile typecheck lint test`
green; admin baselines from W2-0 unchanged. Report the real lockfile delta (`git diff --stat pnpm-lock.yaml`) and the count of new packages.

### W2-3 Preferences storage and pure helpers
Files: `src/storage/prefs.ts`, `src/theme/font-scale.ts`, `test/prefs.test.ts`, `test/font-scale.test.ts`.
- `PrefStorage = { getItem(key): Promise<string|null>; setItem(key, value): Promise<void> }`; `asyncStoragePrefs` adapter wraps AsyncStorage (the only file importing it);
  `memoryPrefs()` for tests. Keys: `rakhal.pref.theme` (`system|light|dark`), `rakhal.pref.locale` (`bn|en`), `rakhal.pref.digits` (`latn|beng`).
  `parseThemePref/parseLocale/parseDigits` return the default for any unknown/garbage/missing value (never throw); read failure => defaults, write failure => swallowed + logged (UI state still changes).
- `font-scale.ts` (no RN imports): `maxFontSizeMultiplier: Record<TextRole, number>` and `effectiveScale(role, systemScale, override?)`. Default table **[proposal, O9]**:
  caption/label/body/button/title = **2.0** (meets the 200% requirement), h2 = 1.75, h1/stat = 1.5 (already large type). `effectiveScale = min(override ?? systemScale, cap)`.
Done when: node tests cover garbage input, defaults, cap table completeness over every `TextRole`, and the override math.

### W2-4 Fonts
Files: `src/theme/fonts.ts`, `src/providers/useAppReady.ts` (font half).
`fonts.ts` maps tokens' family-name strings to deep-imported assets (`@expo-google-fonts/inter/400Regular`, `/500Medium`, `/600SemiBold`, same for noto-sans-bengali) and exports
`fontAssets` for `useFonts`. A node-safe unit test cannot import it (assets); instead a Jest test asserts that `Object.keys(fontAssets)` equals exactly the set of
family names that `textStyle(role, script)` can return for every role and script (so tokens and loader can never drift). Never import the package barrel (1.3).
Done when: Jest test above green; `expo export` bundle (V1) includes only the 6 TTFs (check the asset list in the export output).

### W2-5 ThemeProvider and `useTheme`
Files: `src/providers/ThemeProvider.tsx`, test `src/providers/ThemeProvider.test.tsx`.
- Preference `system | light | dark`, default `system`. Resolved scheme from `useColorScheme()` when `system`. On explicit choice call `Appearance.setColorScheme()` so native chrome
  matches; on `system` call `Appearance.setColorScheme(null)`. Persist through `PrefStorage` (prop, default `asyncStoragePrefs`; tests inject `memoryPrefs`).
- `useTheme()` returns `{ mode, setMode, scheme: 'light'|'dark', isDark, colors: allColors[scheme] /* AllColorTokens: web-shared + mobile-only */, tokens: { radius, spacing, touchTarget, elevation, shadowColor } }`.
  Colours are exposed **only** as token names; no helper returns raw literals outside `tokens.ts`. `textOnTint()` stays the way to pick text on tints (WP1 rule).
- Hydration: provider exposes `hydrated` (internal) consumed by `useAppReady`. Until hydrated, children are not rendered (the splash is still up).
Done when: Jest: default = system; explicit modes override the mocked system scheme; `setMode` updates context synchronously and persists; remount reads persisted; garbage stored value => system.

### W2-6 LocaleProvider, `useLocale`, `useFormat`, messages
Files: `src/providers/LocaleProvider.tsx`, `src/i18n/messages.ts`, `src/i18n/useFormat.ts`, tests.
- `useLocale()` -> `{ locale, script: TextScript, setLocale, digits, setDigits, t }`. Default `bn` regardless of device language. `setLocale` is synchronous state (instant
  re-render of every consumer); persistence is fire-and-forget, last-write-wins. `t(key)` is a typed lookup in `messages.ts` (`{bn,en}` with identical key sets, enforced by a test);
  **no string concatenation of translated fragments** (a `t` key takes named params through a single template, e.g. `{count}`).
- `useFormat()` -> `{ money(n), number(n, opts?), date(d, style?), dateTime(d) }` bound to current `locale` and `digits` from `@rakhal/domain`.
- No i18n library in WP2 (O11 keeps the choice open; web uses namespaced `bn.json`/`en.json` and the mobile dictionary should stay JSON-shaped so it can adopt that later).
Done when: Jest: switching locale re-renders consumers in the same tick and persists; messages key parity; `useFormat().money(1250000)` = `৳12,50,000` in both locales.

### W2-7 Text and Heading primitives
Files: `src/components/primitives/Text.tsx`, `TextScaleContext.tsx`, tests.
- `Text` props: `role: TextRole` (default `body`), `color?: AnyColorName` (default `foreground`, resolved through `useTheme().colors`), `script?: 'auto' | TextScript` (default `auto`),
  `weight?: 'regular'|'medium'|'semibold'` (overrides the role's weight; selects a different **family name**), plus `TextProps`. `Heading` = `Text` with `role` `h1|h2`
  and `accessibilityRole="header"`.
- Style comes only from `textStyle(role, resolvedScript)`: `fontFamily`, `fontSize`, `lineHeight` (Bangla ratios 1.4-1.6 from tokens). **Never set `fontWeight`**: with per-weight custom
  families Android may synthesize or ignore it. **Never set a fixed `height`/`numberOfLines` default**: Bangla must wrap, not truncate or clip.
- `resolvedScript`: `script==='auto'` ? `scriptOfText(flattenedChildren, scriptForLocale(locale))` : `script`. Children that are not strings/numbers fall back to the locale script.
- Font scale: always `allowFontScaling` true and `maxFontSizeMultiplier = font-scale.ts` cap for the role, unless a `TextScaleContext` override is present (gallery/tests): then
  `allowFontScaling={false}` and `fontSize`/`lineHeight` are multiplied manually by `effectiveScale(role, systemFontScale, override)`. Assumption [A]: RN scales an explicit `lineHeight` together with the font on both
  platforms (it does in `sp` on Android; check on the emulator at 200%); if it does not, multiply `lineHeight` explicitly in `Text` and cover it with a test.
- Android: keep `includeFontPadding` at its default for Bengali (turning it off risks clipping conjunct descenders) [A, check in V6].
Done when: Jest: role->style mapping for both scripts matches `textStyle`; `script='auto'` flips to Noto for `৳`; cap present on every role; override scales fontSize and lineHeight and is clamped to the cap;
no `fontWeight`, no `height` in resulting style (assert on the flattened style object).

### W2-8 Root layout, splash hold, gallery
Files: `app/_layout.tsx`, `app/index.tsx`, `app/dev/gallery.tsx`, `src/providers/AppProviders.tsx`, `src/providers/useAppReady.ts`, tests.
- `_layout.tsx` calls `SplashScreen.preventAutoHideAsync()` at module scope. `useAppReady()` = fonts loaded **or errored** (never brick on a font failure; log it) **and** prefs hydrated.
  When ready: `SplashScreen.hideAsync()` then render `<AppProviders><StatusBar style={isDark ? 'light':'dark'} /><Slot/></AppProviders>`. While not ready render `null` (splash covers it).
  Root view background = `colors.background` so no white frame shows on dark between splash and first paint.
- Gallery (`__DEV__` only; non-dev `<Redirect href="/" />`): sections for (a) theme switch System/Light/Dark with live token swatches (token names + resolved values from `useTheme()`),
  (b) locale switch bn/en (+ digits Latin/Bangla), (c) every `TextRole` in both scripts with a long Bangla wrapping sample and a conjunct-heavy sample (e.g. "দুগ্ধ উৎপাদন ক্ষমতা"),
  (d) money/number/date samples via `useFormat` (`৳12,50,000`, `৳1,00,000`, a negative, a date), (e) a font-scale control that wraps the page in `TextScaleContext` at 1.0 / 1.3 / 2.0 plus a readout of the
  system `PixelRatio.getFontScale()`, (f) the "Formatter self-test" + "Intl probe" rows (5.2). No WP3 components: raw RN `View`/`Pressable` styled by tokens only, no reusable Button.
Done when: gallery renders under Jest in both themes and locales; the app bundles (V1).

### W2-9 Docs and handoff
Update `docs/mobile/ux-brand-plan.md` "WP2 status" (append only), record actual versions and lockfile delta in the PR description, list what was verified on device vs not.
Do not edit ADR-005 (the amendment below is the record).

---

## 7. Verify-first checks (run before building on assumptions)

| # | Check | If it fails |
|---|---|---|
| V1 | `pnpm --filter @rakhal/mobile exec expo export --platform android --output-dir <scratch>/dist` bundles with no unresolved modules: proves Metro resolves `@rakhal/domain` via the workspace symlink, explicit `.ts` specifiers inside `src/theme/*.ts` and domain, deep font imports, and pnpm isolated resolution. Output dir is git-ignored (`dist`) | add a `metro.config.cjs` minimal fix; never switch to hoisted without O3 |
| V2 | The auto-detected workspace root is the repo root (`expo config` / Metro startup log prints watch folders; confirm `packages/domain` is included) | set `watchFolders` explicitly in `metro.config.cjs`, just `[repoRoot/packages/domain]` + root `node_modules` |
| V3 | A `apps/mobile/test/*.test.ts` can `import "@rakhal/domain"` under plain `node --test` (type-stripping through the symlink real path) | import by relative path in those tests only; keep `exports` as is |
| V4 | `tsc --noEmit` passes with `jsx: react-jsx`, `lib` as specified, and WP1 files unchanged | try adding `dom` to `lib`; do not weaken `strict` |
| V5 | `jest --ci` parses a trivial `.tsx` test that renders `<Text>` from RN with pnpm layout | fix `transformIgnorePatterns` (4.3); add `babel.config.cjs` with `babel-preset-expo` only if parsing still fails |
| V6 | On the Android emulator: Bangla text with conjuncts renders in Noto Sans Bengali (not a system font), 200% scale does not clip (`adb shell settings put system font_scale 2.0`), explicit `lineHeight` scales | adjust `ratio`/`includeFontPadding` per role in tokens (a WP1 tokens change needs Forma review) |
| V7 | `pnpm install --frozen-lockfile` from a clean clone exit 0 after committing the lockfile; admin importer block unchanged; `pnpm why react --filter @rakhal/admin` = 19.2.4 | stop and escalate (section 3.3) |

---

## 8. Acceptance (mapped to WP2) and who tests what

### 8.1 WP2 acceptance (ux-brand-plan section 4) -> evidence

| WP2 acceptance | Implemented by | Automated (Node / Jest) | Needs device or emulator |
|---|---|---|---|
| Bangla and Latin render in the brand fonts, no fallback flash | W2-4, W2-7, W2-8 (splash hold, per-string script) | Jest: font map = family names required by tokens; `Text` picks Bengali family for `৳`/Bangla; `AppProviders` renders nothing until fonts+prefs ready (mock `useFonts`) | Cold-start x3 on emulator: no system-font flash, `৳` glyph in `en` renders via Noto Sans Bengali, conjuncts correct (screenshots) |
| 200% system font scale does not clip core screens | W2-3, W2-7, gallery scale control | Node: cap table complete; Jest: override scaling clamped; style has no fixed height | `adb shell settings put system font_scale 2.0` then gallery screenshots (cap applies: h1/stat clamp at 1.5, body at 2.0); low-RAM AVD |
| `formatMoney(1250000)` = `৳12,50,000` on Android and iOS | W2-1 | Node: golden + differential tests. Engine-independent by construction (no `Intl`) | Android: gallery "Formatter self-test" on Hermes, expect all golden vectors pass. **iOS: not verifiable on this machine** (Windows); parity relies on the no-`Intl` design, recorded as unverified on iOS |
| Locale switch instant and persists | W2-6 | Jest: same-tick re-render; persistence via injected storage; remount restores | Kill and relaunch on emulator: locale + theme restored with no flash |
| (plan WP1 carry-over) Theme follows system, persisted, dark readable | W2-5 | Jest: modes + persistence | Dark theme on a physical device (still an open WP1 item) |
| No raw hex outside tokens; no `@rakhal/ui` import | lint + WP1 boundary test | `node --test` boundary test (extended per 4.4), ESLint rule | - |

### 8.2 What Verity can run without a device

`pnpm --filter @rakhal/domain test` (golden + differential + source-scan), `pnpm --filter @rakhal/mobile test:node` (WP1 suite + prefs, font-scale, app-config sync, boundary),
`pnpm --filter @rakhal/mobile test:components` (Jest), `typecheck`, `lint`, and `turbo run lint typecheck test` repo-wide. Evidence for "formatter correct on Hermes" requires the
emulator self-test (8.1).

### 8.3 Device/emulator availability on this machine (read-only inspection, 2026-11-11)

- Android SDK present at `C:\Users\mdgal\AppData\Local\Android\Sdk`: `platform-tools\adb.exe`, `emulator\emulator.exe`, `build-tools` 36.1.0 and 37.0.0,
  `platforms\android-36.1`, `system-images\...\google_apis_playstore\x86_64`. AVD `Pixel_8` exists (Play Store image, API 37, x86_64, 4096 MB RAM). A hypervisor is detected.
- **Not configured:** `adb`/`emulator` are not on `PATH`; `ANDROID_HOME`/`ANDROID_SDK_ROOT` are unset; no `java` on `PATH` (a JDK exists inside Android Studio's `jbr`).
  `adb devices` lists no attached device and no emulator is running (that query may have started the adb daemon; no other effect). Expo Go on the AVD is expected to be
  installed by `expo start --android` through adb [A]; not tried. The AVD is 4 GB, so a "low-end" check needs a second AVD (2 GB RAM, small screen), which Verity creates.
- No macOS/iOS tooling: iOS is out of reach on this machine; state it in the report rather than claim parity.
- Native builds (`expo prebuild`, Gradle, EAS) are not needed for WP2: JS-only via Expo Go/dev client is enough.

---

## 9. CI plan

### 9.1 What turbo runs (unchanged workflow `pnpm turbo run lint typecheck test`, then `build`)

| Package | lint | typecheck | test | build |
|---|---|---|---|---|
| `@rakhal/domain` (new) | `eslint .` | `tsc --noEmit` | `node --test` (golden, differential, source-scan) | none (turbo skips) |
| `@rakhal/mobile` | `eslint .` (new) | `tsc --noEmit` | `test:node` (WP1 suite + new pure tests + token drift) then `test:components` (Jest) | none |
| `@rakhal/admin`, `@rakhal/ui`, others | unchanged | unchanged | unchanged | admin build unchanged |

- `turbo.json` needs no change: the tasks are generic; source-exported packages need no `^build`. Packages without a `build` script are skipped by `turbo run build`, so web build time is unchanged.
- Node 24 in CI (WP1's one-line `ci.yml` change) is required by `apps/mobile` `engines >=24` and satisfies Expo 58 (`^24.3`). The admin app has not yet run on Node 24 in CI (open WP1 item): the first run
  after WP1+WP2 land is the admin Node-24 test; if it fails, fix by pinning the admin job rather than lowering mobile.
- **Frozen lockfile:** `pnpm install --frozen-lockfile` fails unless `pnpm-lock.yaml` is committed with the `package.json` changes. Codex must generate it with the single authorised `pnpm install` per commit (W2-1 small, W2-2 large) and
  commit lockfile and manifests together. Expected size of the W2-2 delta **[A: not measured; no install allowed in this task]**: roughly +6,000 to +11,000 lines and 700-1,300 new package entries (Expo + RN + Metro + Jest 30 + RNTL, against a
  6,880-line lockfile today). BusinessOS, with comparable mobile deps and more apps, has a 15,258-line lockfile. Codex reports the real numbers.
- Time: install grows (pnpm store cached by `actions/setup-node cache: pnpm`); Jest-expo adds roughly one to a few minutes. Acceptable; if CI time becomes an issue, path-filter later (06-mobile-track CI section), not in WP2.

### 9.2 Keeping the existing mobile `test` green

`test` used to be `node --test "test/*.test.ts" && node scripts/check-token-drift.ts`. It is preserved verbatim as `test:node`, and `test` chains `test:node` then `test:components`. WP1's 73 tests stay in `test/`.
Jest's `testMatch` is `src/**/*.test.tsx` only, so it never tries to run `node:test` files; Node's glob `test/*.test.ts` never sees `src/`. The only WP1 file edited is `boundary.test.ts` (one allowlist entry, O10).

### 9.3 Do not run in CI yet

EAS (build/update/submit), `expo prebuild`, `expo run:*`, Gradle/Xcode, `expo-doctor` as a gate, `expo export` (propose later as a non-blocking JS-bundle smoke job once stable), device or emulator tests, any
workflow that needs Expo/EAS secrets. No credentials in the repo (the Firebase key under `D:\Projects\Rakhal\conf` stays untracked).

---

## 10. Risks (numbered)

1. **Lockfile blast radius.** One large change touches `pnpm-lock.yaml`; a rebase conflict or a bad merge breaks `--frozen-lockfile` for everyone. Mitigation: two commits (small then large), lockfile regenerated, never hand-edited; admin importer block must be identical (V7).
2. **Metro + pnpm isolated has not been run here.** Evidence is source reading plus BusinessOS precedent. Mitigation: V1/V2 before any feature work; fallbacks ordered: minimal `metro.config.cjs` -> targeted `public-hoist-pattern` (root, owner-approved) -> hoisted linker (last resort, O3).
3. **`"type": "module"` vs Expo config loading.** Any `.js` config would be ESM. Mitigation: no configs where Expo has defaults; `.cjs` otherwise (V1, V5).
4. **`.ts` import specifiers under Metro/Jest/Next.** Works for Node, Metro and Jest (explicit extension resolves); Next/admin typecheck needs `allowImportingTsExtensions` when admin adopts domain (O6).
5. **Jest + pnpm transform pitfall** (`transformIgnorePatterns`). Mitigation: V5.
6. **Hermes `Intl` / `Number` -> string behaviour unverified.** Mitigated by not using `Intl`; remaining dependency is that Hermes `String(number)`/`parseFloat` follow the spec for shortest-decimal output [A], covered by the on-device self-test (8.1). iOS unverified on this machine.
7. **Font glyph gaps.** Inter lacks `৳`/Bangla digits/ZWJ [V]. `script="auto"` handles whole strings; mixed inline money inside Latin sentences needs spans (WP3, O8). Android system fallback for any other Bengali glyph in an Inter run would flash a different font.
8. **Font scale.** 200% with Bangla line heights may clip in WP3 components; the primitive caps and avoids fixed heights, but components (Button min-height 56, inputs) must use `minHeight`, not `height` (WP3 constraint). Caps at 1.5 for h1/stat are a policy choice (O9).
9. **Two React minors** (19.2.4 vs 19.3.0): safe under isolation; breaks if anyone adds a package that peers `react` exactly and is used by both apps (`@rakhal/ui` does: `19.2.4`). Rule: nothing shared between the apps depends on `react` (domain has no React dependency by design).
10. **`@rakhal/config` ESLint preset is web-flavoured** (fetch ban is fine, `no-alert`, hex ban). The new lint may flag existing WP1 `scripts/`/`test/`; fix with behaviour-free edits or scoped `ignores`, reported; do not loosen rules globally.
11. **Splash/boot ordering** (fonts + AsyncStorage hydrate + splash hide): a bug shows as a white or wrong-theme flash. Covered by the gate test and V6 cold-start check.
12. **Scope creep into WP3/WP4.** The gallery must use raw RN views only; no Button, no tabs, no API client, no secure-store.
13. **Engines drift.** Root `engines >=20.9` is now below what Expo needs; harmless warning today, but anyone running Node 20 locally cannot run mobile. Owner may want to raise the root engine (O1).
14. **Parallel work on the shared tree.** The WP1 files and `ci.yml`/`pnpm-lock.yaml` are still uncommitted; WP2 builds on that exact state. Commit WP1 first (per the WP1 note) or WP2's lockfile diff will mix both.

## 11. Open owner decisions

| # | Decision | Recommendation | Needed before |
|---|---|---|---|
| O1 | Approve the large `pnpm-lock.yaml` change (section 9.1) in two commits; no change to root `engines`/`onlyBuiltDependencies` | Approve | W2-2 |
| O2 | Approve creating `packages/domain` now (ADR-005 decision 4 allows it; second consumer = web formatters later) | Approve | W2-1 |
| O3 | Confirm **no root `.npmrc` change** and no hoisted linker in WP2; any later hoisting change comes back for approval | Confirm | W2-2 |
| O4 | Accept React 19.3.0 (mobile) alongside 19.2.4 (admin) | Accept; do not upgrade admin for this | W2-2 |
| O5 | Add ESLint (`@rakhal/config`) to `apps/mobile` and `packages/domain` | Approve | W2-1/2 |
| O6 | Admin adds `allowImportingTsExtensions` when it first consumes `@rakhal/domain` | Defer; separate ticket | domain adoption in web |
| O7 | Negative money format: web parity `৳-1,234` or `-৳1,234` | Forma decides; default web parity | W2-1 golden vectors |
| O8 | Fonts: load 3 weights (no bold) now; money in Bengali font only by whole-string `auto` for now, spans in WP3 | Approve | W2-4 |
| O9 | Font-scale caps (2.0 body-class, 1.75 h2, 1.5 h1/stat) | Forma confirms; WCAG 1.4.4 wants 200% for body text | W2-3 |
| O10 | One-line allowlist for `app.json` in the WP1 boundary test plus the new token-sync test | Approve (Verity/Critica review) | W2-2 |
| O11 | i18n library choice (hand-typed dictionary now; revisit at WP4/5, keep JSON-compatible with web) | Defer | WP4 |
| O12 | App identity: bundle id, Android package, EAS project, icon/splash image, light logo (still open from X0) | Owner supplies; WP2 does not need it | first native build |
| O13 | Extract `@rakhal/tokens` (Q4) | Not now | after web CSS generator exists |
| O14 | Update ADR-005 header status and context line (see amendment) | Owner/Structa applies after this spec is accepted | scaffold PR |

---

## ADR amendment (to ADR-005; ADR-005 itself is not edited here)

**ADR-005 amendment A1 - 2026-11-11 - Owner sign-off to build the Expo scaffold now**

Context change. The owner has signed off on building the `apps/mobile` Expo scaffold now, as WP2 of the mobile UX plan. ADR-005 was "proposed" and required sign-off on decisions 4 and 5 before
the scaffold starts; this amendment records that the scaffold may proceed. Intended reading of the sign-off, to be confirmed by the owner when ADR-005's header is updated (O14): it covers the Expo scaffold, `@rakhal/domain`
and the theme/locale/typography work in `docs/mobile/wp2-scaffold-spec.md`; it does **not** cover any offline screen (decision 5 still applies: an offline-sync ADR precedes any offline code) and
does **not** enable EAS/native builds (decision 7, owner scale answer first).

Effects on the decisions:
- **Decision 1 (start after M4):** the scaffold now starts before M4. Consequence: WP2 makes no API calls and uses no `@rakhal/api-client`; the 06-mobile-track X1 exit criterion "renders a screen that calls `GET /health`
  through `@rakhal/api-client`" moves to the first slice after M4 (X2/WP4). The rest of X1 (clean install, typecheck/lint/test green, boots in Expo Go) applies to WP2.
- **Decision 2 (versions recorded at scaffold time):** Expo SDK **58.0.23**, React Native **0.88.1**, React **19.3.0** (exact; RN peer `^19.3.0`), checked against the registry and `bundledNativeModules.json` on 2026-11-11.
  Admin stays on React 19.2.4; per-app React pinning (decision 2) is what makes the two minors coexist.
- **Decision 3 (source exports):** reaffirmed, with one rule added: relative imports in source-exported packages used by mobile carry `.ts` extensions (Node type-stripping), and a future Next consumer enables `allowImportingTsExtensions`.
- **Decision 4 (sharing):** `@rakhal/domain` is created now (pure TS, zero dependencies, no `Intl`: money with lakh grouping, digits, number and date formatting, locale types). `@rakhal/validation` is not created in WP2.
  Design tokens remain in `apps/mobile/src/theme` (Q4 deferred); `@rakhal/ui` remains unshared and boundary-tested.
- **Context correction:** ADR-005 states BusinessOS mobile is Expo 52 / React 18.3.1 / RN 0.76. Its current `package.json` is Expo ~58.0.23 / React 19.3.0 / RN 0.88.1 / expo-router ~58.0.30. The implementation reference is therefore
  current-generation; the instruction not to copy its versions is moot, but its custom `metro.config.js` is still not copied (Expo 58 configures monorepos itself).
- **Install/linker policy (new):** no root `.npmrc` change and no `node-linker=hoisted`; if hoisting is ever required it is a separately approved, targeted `public-hoist-pattern` first. Supersedes the 06-mobile-track X1 hint of an `apps/mobile/.npmrc`.
- **Decision 7 (CI):** unchanged. WP2 adds `lint`, `typecheck`, `test` for `@rakhal/domain` and `@rakhal/mobile` to the existing turbo run; no device or EAS jobs.

Consequences. Positive: the typography/locale foundation and a single tested formatter exist before any feature screen; formatting no longer depends on engine `Intl`. Negative: a large one-time lockfile change; two React minors in one lockfile;
the on-device formatter evidence is Android-only on this machine. Revisit: after WP4, whether `domain` earned its place (as ADR-005 already states) and whether to extract `@rakhal/tokens`.
