import { test as base, expect, type Page } from "@playwright/test";
import { localeCookieName } from "../../lib/constants/i18n";

/**
 * The app is **Bangla-first by product decision** (`bn` is the default locale, cookie-persisted —
 * see `lib/constants/i18n.ts`). E2E assertions need stable strings, so every test in this harness
 * pins the locale to `en` via this fixture rather than asserting on Bangla copy — both locales
 * render the identical component tree, so this doesn't reduce coverage of the actual logic.
 */
export const test = base.extend({
  // Playwright's fixture callback's 2nd param is conventionally named `use` — renamed to
  // `runWithFixture` here because eslint-plugin-react-hooks heuristically (and incorrectly)
  // treats any function literally named `use` as a React hook call.
  context: async ({ context }, runWithFixture) => {
    await context.addCookies([
      { name: localeCookieName, value: "en", domain: "localhost", path: "/" },
    ]);
    await runWithFixture(context);
  },
});
export { expect };

/**
 * Demo seed users (`Repos/rakhal-backend/prisma/seed.ts`, `pnpm seed`). The dev backend must be
 * running with a seeded DB for any of these to work — see docs/ARCHITECTURE.md §8.
 */
export const DEMO_OWNER = { email: "owner@demo.rakhal.test", password: "DemoPass123" };
export const DEMO_MANAGER = { email: "manager@demo.rakhal.test", password: "ManagerPass123" };
export const DEMO_WORKER = { email: "worker@demo.rakhal.test", password: "WorkerPass123" };

/**
 * Drives the real `/login` UI end-to-end (not an API shortcut — this is a browser E2E harness,
 * mirrors the backend's `test/utils/e2e.ts#loginAs` in spirit but through the actual pages).
 * The demo owner has 5 farms (see RFE-003/006 verification notes), so a farm-picker step is
 * expected and handled here; single-farm accounts (manager/worker) skip straight to the dashboard.
 */
export async function loginViaUi(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(credentials.email);
  // Exact match: FloatingInput's password-visibility toggle button is also aria-labelled
  // "Show/Hide password", which /password/i would ambiguously match too.
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: /log in/i }).click();

  // Either a farm-picker list appears (multi-farm accounts) or we land straight on /dashboard.
  const farmButton = page.locator("li button").first();
  const dashboardHeading = page.getByRole("heading", { name: /dashboard/i });
  await expect(farmButton.or(dashboardHeading)).toBeVisible({ timeout: 10_000 });
  if (await farmButton.isVisible().catch(() => false)) {
    await farmButton.click();
  }
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}

/** A unique-per-run email so repeated E2E runs never collide on the backend's unique constraint. */
export function uniqueTestEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/**
 * The form-level submit error (`bg-destructive-tint`) vs. `FloatingInput`'s per-field error
 * (`role="alert"` too, but no tint background) both render inside the form — scope to the tint
 * class so tests can tell "the mutation failed" apart from "a field failed client validation".
 */
export function formLevelAlert(page: Page) {
  return page.locator('form [role="alert"].bg-destructive-tint');
}
