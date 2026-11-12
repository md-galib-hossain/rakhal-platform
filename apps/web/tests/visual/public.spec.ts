import { expect, test } from "@playwright/test";

/**
 * Tier A: public routes, the real app, no data. Covers tokens, fonts, buttons, inputs, labels and checkboxes in
 * both themes at desktop and 375 px (projects are defined in `playwright.visual.config.ts`).
 */
const publicRoutes = [
  { name: "login", path: "/login" },
  { name: "register", path: "/register" },
  { name: "forgot-password", path: "/forgot-password" },
] as const;

for (const route of publicRoutes) {
  test(`public: ${route.name}`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${route.name}.png`, { fullPage: true });
  });
}
