# M3 visual-regression gate: built and proven locally (2026-11-12, not pushed)

Implements the design approved from `M3-prep-visual-gate-and-branching-2026-11-12.md`. Branch
`migrate/m3-visual-gate`, stacked on `migrate/m3-prep` on `migrate/web` (option a). Nothing is pushed.

## What it is

`node scripts/visual-gate.mjs --base <ref>` (root script `pnpm visual:gate`, default base `origin/main`):

1. adds a git worktree of the base ref and installs its dependencies from its own lockfile;
2. copies the gate definition from HEAD into the base worktree, so a PR that adds or changes the gate still has a
   base to compare against;
3. builds the base, runs the specs there with `--update-snapshots` (writes `apps/web/tests/visual/.baseline/`);
4. builds HEAD, copies the baseline across and runs the specs again to compare;
5. exits non-zero on any difference. It SKIPS (exit 0, with a notice) when the base has no `apps/web`, which is the
   case for the import PR itself.

No screenshot is committed (`.baseline`, `test-results-visual`, `playwright-report-visual` are git-ignored), and
baseline and comparison always come from the same machine, so Windows-vs-Linux text rendering cannot cause a false
failure.

## Files

| File | Purpose |
|---|---|
| `apps/web/playwright.visual.config.ts` | Separate Playwright config: 4 projects (desktop 1280x800 and mobile 375x812, each light and dark via `colorScheme`), production build served with `next start`, mock API started alongside, strict threshold (`maxDiffPixels: 10`), `animations: "disabled"`, `reducedMotion`, fixed locale and timezone. Existing `playwright.config.ts` (real-backend e2e) is untouched. |
| `apps/web/tests/visual/public.spec.ts` | Tier A: `/login`, `/register`, `/forgot-password`, real app, no data. |
| `apps/web/tests/visual/authed.spec.ts` | Tier B: dashboard, animals list, add-animal form sheet, confirm dialog (delete animal group). Controls are found through `i18n/messages/bn.json`, not hard-coded strings. Browser clock fixed to 2026-01-15. |
| `apps/web/tests/visual/session.ts` | Signs a context in with no backend: `proxy.ts` and `getSession()` only decode the access token, so an unsigned JWT with a year-2100 `exp` plus the four session cookies is a full session. |
| `apps/web/tests/visual/mock-api/server.mjs` | Dependency-free `node:http` stand-in for the backend, pointed at through the single `API_BASE_URL` env var (serves both BFF and server-side fetches). Unknown routes return a 404 envelope and are logged. |
| `apps/web/tests/visual/mock-api/fixtures.mts` | 24 static routes (shell, 12 dashboard endpoints, cattle list with per-category filtering, highlights, breeds, sheds, animal groups, activity log, feed cost, milk overview, subscription, notifications). Every payload is typed against the app's own `features/*/types.ts` (type-only imports, erased by Node 24), so a type change fails `pnpm typecheck`. Fixtures are not derived from the backend OpenAPI types: the web app's own types are what the UI consumes, and they are the ones that break first. |
| `.github/workflows/visual.yml` | PR workflow: full-history checkout, install, `playwright install --with-deps chromium` (the only extra download), the gate, upload of report and diffs on failure. Path-filtered. |
| `scripts/visual-gate.mjs`, root `package.json` | Orchestration and `visual:gate` script. `apps/web/package.json` gains `test:visual`. |

28 screenshots per run: (3 public + 4 authenticated) = 7 specs x 4 projects.

## Proof run locally (Windows, Edge as the browser, base `86ee1f2` = `migrate/m3-prep`, which has no gate)

| Scenario | Result |
|---|---|
| Same-build compare, run twice | 28 passed, 28 passed (stable: no flake) |
| `visual-gate.mjs --base 86ee1f2`, HEAD identical to base apart from the gate files | **PASS** in 176 s (base 28 written, head 28 compared) |
| Same, after one deliberate class change in `apps/web/components/ui/button.tsx` (`rounded-md` to `rounded-xl`) | **FAIL**, exit 1, 179 s: 24 passed, 4 failed (the confirm dialog, in all four projects) |
| Change reverted | `git diff` on `button.tsx` is empty; same-build compare passes again |
| `--base main` (no `apps/web` on main) | SKIPPED, exit 0, worktree removed |
| Unknown ref / missing argument | exit 1 / exit 2 with a clear message |

Finding from that proof: with the first threshold (`maxDiffPixelRatio: 0.001`, about 1,000 px at desktop size) the
`rounded-xl` change **passed** undetected, because a corner radius moves only tens of pixels. The gate now uses
`maxDiffPixels: 10`. Strict is affordable only because base and head are rendered on the same machine in one run.
Also note the change surfaced in only 4 of 28 screenshots: most buttons on login, dashboard and animals override the
radius through their own classes. The dialog buttons are the ones that use the component's default.

## Verified locally vs only by CI

Verified locally: the specs, mock API, fixtures (typed, `tsc` 0), eslint on the new files (0), the full orchestration
on identical and on changed code, the skip path, the workflow YAML parses.

Not run locally: `playwright install chromium` (no downloads allowed, and the Playwright 1.65 browser revision is not
installed on this machine, so local runs set `VISUAL_CHANNEL=msedge`); the workflow itself on GitHub; Linux
rendering. Only CI can prove: (1) `visual.yml` triggers and passes on `ubuntu-latest`, including
`playwright install --with-deps chromium`; (2) that two builds and two screenshot passes fit the 30-minute timeout
(about 3 minutes locally); (3) Linux font and rendering stability (same-machine design means it should hold, but it
has not been observed); (4) the artifact upload.

## Known limits

- The gate definition comes from HEAD, app code from each side. A PR that renames a label the specs look up in
  `bn.json` makes the base run fail to find the control: loud, not silent, but it needs a spec update first.
- Coverage is 7 screens. Wave 1 components visible in them: utton, adge, card, label, checkbox (the table
  row checkboxes on the animals list) and 	extarea (the add-animal sheet, below its first scroll position, so only
  partly). **Not covered: switch and adio-group** (neither is on these screens), and skeleton only shows in
  loading states, which the specs wait out. Add a screen for each before its dedupe PR, or the gate cannot see it.
- Mock data is static: it proves rendering, not data behaviour.

## Not done

Wave 1 plumbing, the font change and every component change were not started (waiting for the owner relay).
Mirror owner/cadence, `tok.json` handling and the M5 staging story remain open.
