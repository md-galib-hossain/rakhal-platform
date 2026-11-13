import { expect, test, type Page } from "@playwright/test";
import bn from "../../i18n/messages/bn.json";
import { signIn } from "./session";

/**
 * Tier B, UI primitives the other specs do not show: Dialog (create role in settings), Command + Popover (cattle picker), Tooltip, Tabs
 * (tasks filter tabs), Popover + Calendar (tasks date filter) and Progress (onboarding wizard). Added before
 * the M3 wave 2 dedupe of those components so the gate can see a regression in them.
 */
test.beforeEach(async ({ context, page, baseURL }) => {
  await signIn(context, baseURL!);
  await page.clock.setFixedTime(new Date("2026-01-15T08:00:00+06:00"));
});

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

test("overlays: dialog (create role)", async ({ page }) => {
  await page.goto("/settings?tab=team");
  await settle(page);
  await page.getByRole("button", { name: bn.settings.roles.create }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("create-role-dialog.png");
});

test("overlays: command + popover (mother picker in add-animal sheet)", async ({ page }) => {
  await page.goto("/animals");
  await settle(page);
  await page.getByRole("button", { name: bn.cattle.form.addCattle }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const picker = page.getByText(bn.cattle.form.mother, { exact: true }).locator("xpath=following::button[@role='combobox'][1]");
  await picker.scrollIntoViewIfNeeded();
  await picker.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("mother-picker.png");
});

test("overlays: tooltip (theme toggle)", async ({ page }) => {
  await page.goto("/dashboard");
  await settle(page);
  await page.getByRole("button", { name: bn.theme.toggle }).hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("tooltip.png");
});

test("overlays: tabs and popover + calendar (tasks)", async ({ page }) => {
  await page.goto("/tasks");
  await settle(page);
  await expect(page).toHaveScreenshot("tasks-tabs.png", { fullPage: true });

  await page.getByRole("button", { name: bn.tasks.dateFilters.all }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("tasks-date-popover.png");
});

test("overlays: progress (onboarding wizard)", async ({ page }) => {
  await page.goto("/onboarding");
  await settle(page);
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page).toHaveScreenshot("onboarding-progress.png", { fullPage: true });
});
