import { DEMO_OWNER, expect, loginViaUi, test } from "./utils";

/**
 * RFE-194 (NV2-F07) — smoke coverage for Notifications v2: the bell opens a right-side sheet with
 * Inbox / Upcoming / New tabs, the old `/notifications` page is gone, and the New tab shows the
 * composer. Locale is pinned to `en` by the `./utils` fixture.
 *
 * Needs the real dev backend (seeded DB, `pnpm seed`) like `auth.spec.ts`/`sales.spec.ts`. It only
 * opens the composer; it never submits, so nothing is written to the demo farm.
 */
test.describe("notifications — bell sheet", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUi(page, DEMO_OWNER);
  });

  test("the bell opens the sheet with Inbox, Upcoming and New tabs", async ({ page }) => {
    await page.getByRole("button", { name: "Notifications" }).click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const tabs = sheet.getByRole("tablist", { name: "Notification sections" });
    await expect(tabs.getByRole("tab", { name: "Inbox" })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: "Upcoming" })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: "New" })).toBeVisible();
  });

  test("the New tab opens the composer", async ({ page }) => {
    await page.getByRole("button", { name: "Notifications" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("tab", { name: "New" }).click();

    await expect(sheet.getByLabel("Title")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Create notification" })).toBeVisible();
  });

  test("the old /notifications page no longer exists", async ({ page }) => {
    const response = await page.goto("/notifications");
    expect(response?.status()).toBe(404);
  });
});
