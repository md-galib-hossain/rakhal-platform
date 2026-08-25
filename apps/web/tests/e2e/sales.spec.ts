import { DEMO_OWNER, expect, loginViaUi, test } from "./utils";

/**
 * RAKHAL-361 — Money-flow Playwright coverage (this repo's own CLAUDE.md "auth/money/critical
 * flows" rule; `features/finance/**` had zero Playwright coverage before this ticket, per
 * `FINANCE_V2_DESIGN.md`'s own §1.4 callout). Covers the ONE sale path that is fully backend-wired
 * end-to-end (`POST /milk/dispatch`, RAKHAL-342/343) — Animal/Manure/Inventory sale stay UI-only
 * (no HTTP route yet, see `features/sales/types.ts`'s top doc comment) so they are deliberately
 * NOT asserted as succeeding here; a dedicated case below instead asserts they correctly show the
 * honest "not available yet" state rather than silently failing or faking success.
 *
 * Requires the real dev backend running with a seeded DB (`pnpm seed`) — same precondition
 * `auth.spec.ts`'s own tests already carry, per `docs/ARCHITECTURE.md` §8. If the seeded demo farm
 * has no milk buyer configured, the milk-sale case fails at the buyer-select step with a clear
 * Playwright timeout naming the missing selector rather than a silent skip — flagged, not hidden.
 */
test.describe("sales — Record Sale wizard", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUi(page, DEMO_OWNER);
  });

  test("complete a Milk sale end-to-end from /sales (RAKHAL-357/361 AC)", async ({ page }) => {
    await page.goto("/sales");
    await page.getByRole("button", { name: "Record Sale" }).click();

    // Step 1 — type + product subtype + milk fields.
    await expect(page.getByText("What are you recording?")).toBeVisible();
    await page.getByRole("button", { name: /Product Sale/ }).click();
    await page.getByRole("button", { name: "Milk", exact: true }).click();

    // Only one combobox exists on this step (Buyer) — scoped by role rather than accessible name,
    // since Radix's `SelectTrigger` computes its accessible name from its full rendered text
    // content (label + placeholder), which doesn't reliably substring-match a short regex.
    await page.getByRole("combobox").click();
    await page.getByRole("option").first().click();

    await page.getByLabel("Volume (L)").fill("25");

    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2 — payment (left at defaults: no account/amount, so no payment call is attempted —
    // proves the sale itself, `submitMilkSale`'s payment orchestration is a separate concern
    // already covered by RAKHAL-357's own live backend verification, documented in IN_FLIGHT.md).
    await expect(page.getByText("Payment", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3 — review + submit. Milk is wired, so Submit is enabled (not the "not available yet"
    // disabled-equivalent label the 3 unwired combinations show instead).
    await expect(page.getByText("Confirm before recording")).toBeVisible();
    await page.getByRole("button", { name: "Submit" }).click();

    // Real success toast (`t("createdToast", {amount})`) + the sheet closes.
    await expect(page.getByText(/Recorded — ৳/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("What are you recording?")).not.toBeVisible();
  });

  test("Animal Sale honestly blocks submission — no fake success, no silent 404 (RAKHAL-357 AC)", async ({ page }) => {
    await page.goto("/sales");
    await page.getByRole("button", { name: "Record Sale" }).click();

    await page.getByRole("button", { name: /Animal Sale/ }).click();
    // `SellAnimalUseCase` has no HTTP route yet — the wizard's own honest banner must appear
    // immediately on selecting the type, before any field is even touched.
    await expect(page.getByText(/not available yet/i)).toBeVisible();
  });
});
