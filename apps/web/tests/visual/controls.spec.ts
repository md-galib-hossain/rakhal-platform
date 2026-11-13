import { expect, test, type Page } from "@playwright/test";
import bn from "../../i18n/messages/bn.json";
import { signIn } from "./session";

/**
 * Tier B, form controls the other specs do not exercise: Switch (the on-duty toggle in the account menu),
 * Checkbox (report wizard catalogue) and RadioGroup (report wizard period and scope steps). Added before the
 * M3 dedupe of those components so the gate can see a regression in them.
 */
test.beforeEach(async ({ context, page, baseURL }) => {
  await signIn(context, baseURL!);
  await page.clock.setFixedTime(new Date("2026-01-15T08:00:00+06:00"));
});

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

test("controls: switch (account menu)", async ({ page }) => {
  await page.goto("/dashboard");
  await settle(page);
  await page.getByRole("button", { name: new RegExp(bn.topbar.accountMenuHint) }).click();
  await expect(page.getByRole("switch", { name: bn.topbar.onDuty })).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("switch-account-menu.png");
});

test("controls: checkbox, radio-group (report wizard)", async ({ page }) => {
  await page.goto("/reports/new");
  await settle(page);

  // Step 1: catalogue. Tick the first section (checkbox), which selects its metrics.
  await page.getByRole("checkbox").first().click();
  await expect(page).toHaveScreenshot("wizard-catalogue.png", { fullPage: true });

  // Step 2: period presets (radio group).
  await page.getByRole("button", { name: bn.reportsWizard.next }).click();
  await expect(page.getByRole("radio").first()).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("wizard-period.png", { fullPage: true });

  // Step 3: scope (radio group).
  await page.getByRole("button", { name: bn.reportsWizard.next }).click();
  await expect(page.getByRole("radio").first()).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("wizard-scope.png", { fullPage: true });
});
