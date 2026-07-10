import { expectNoA11yViolations } from "./axe";
import { DEMO_OWNER, expect, loginViaUi, test, uniqueTestEmail } from "./utils";

test.describe("auth", () => {
  test("login -> farm picker -> dashboard smoke (RFE-006 AC)", async ({ page }) => {
    await loginViaUi(page, DEMO_OWNER);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("wrong password shows a form-level error, not a crash", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(DEMO_OWNER.email);
    await page.getByLabel(/password/i).fill("DefinitelyWrongPass1");
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.locator("form").getByRole("alert")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("client-side validation blocks an invalid email before any request", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("not-an-email");
    await page.getByLabel(/password/i).fill("whatever123");
    await page.getByRole("button", { name: /log in/i }).click();
    // zodResolver's field error renders inline, not the form-level alert (Next's own
    // #__next-route-announcer__ carries role="alert" too, so scope to the form's own alert).
    await expect(page.locator("form").getByRole("alert")).not.toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("register -> check-your-email success state (RFE-006 AC)", async ({ page }) => {
    const email = uniqueTestEmail("e2e-register");
    await page.goto("/register");
    await page.getByLabel(/full name/i).fill("E2E Test User");
    await page.getByLabel(/^email$/i).fill(email);
    await page.getByLabel(/^password$/i).fill("TestPass123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(email)).toBeVisible();
  });

  test("duplicate email on register surfaces the backend conflict message", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel(/full name/i).fill("Duplicate");
    await page.getByLabel(/^email$/i).fill(DEMO_OWNER.email);
    await page.getByLabel(/^password$/i).fill("TestPass123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /check your email/i })).not.toBeVisible();
  });

  test("forgot-password always shows the same success state (no user enumeration)", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel(/email/i).fill("no-such-user@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible({ timeout: 10_000 });
  });

  test("reset-password with no token shows the invalid-link state", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByRole("link", { name: /request a new link/i })).toBeVisible();
  });

  test("verify-email with no token shows the invalid-link state", async ({ page }) => {
    await page.goto("/verify-email");
    await expect(page.getByRole("heading", { name: /verification failed/i })).toBeVisible();
  });

  test("unauthenticated user is redirected off a protected route", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("login page has no serious accessibility violations", async ({ page }) => {
    await page.goto("/login");
    await expectNoA11yViolations(page);
  });
});
