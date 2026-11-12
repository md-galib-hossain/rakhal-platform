import { expect, test, type Page } from "@playwright/test";
import bn from "../../i18n/messages/bn.json";
import { signIn } from "./session";

/**
 * Tier B: authenticated routes against the mock API (no backend). Five screens: dashboard, animals list, a form
 * sheet (add animal), a confirm dialog (delete an animal group), plus the login page from `public.spec.ts`.
 * Each runs in the four projects of `playwright.visual.config.ts` (desktop / 375 px, light / dark).
 *
 * The app's default locale is Bengali, so controls are found through the app's own message catalogue
 * (`i18n/messages/bn.json`) instead of hard-coded strings: reword a label and the lookup follows.
 */
test.beforeEach(async ({ context, page, baseURL }) => {
  await signIn(context, baseURL!);
  // Client-side `new Date()` (ages, "x days ago") must not depend on when the suite runs.
  await page.clock.setFixedTime(new Date("2026-01-15T08:00:00+06:00"));
});

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

test("authed: dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await settle(page);
  await expect(page).toHaveScreenshot("dashboard.png", { fullPage: true });
});

test("authed: animals list", async ({ page }) => {
  await page.goto("/animals");
  await settle(page);
  await expect(page).toHaveScreenshot("animals.png", { fullPage: true });
});

test("authed: form sheet (add animal)", async ({ page }) => {
  await page.goto("/animals");
  await settle(page);
  await page.getByRole("button", { name: bn.cattle.form.addCattle }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("form-sheet.png");
});

test("authed: confirm dialog (delete animal group)", async ({ page }) => {
  await page.goto("/animals");
  await settle(page);
  await page.getByRole("button", { name: bn.cattle.groups.button }).click();
  await page.getByTitle(bn.cattle.groups.deleteGroup).first().click();
  await expect(page.getByRole("alertdialog").or(page.getByRole("dialog")).last()).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("confirm-dialog.png");
});
