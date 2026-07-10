import { expect, type Page } from "@playwright/test";
import { getViolations, injectAxe } from "axe-playwright";

/** Fails the test with a readable list of violations (rule id + affected selectors). */
export async function expectNoA11yViolations(page: Page) {
  await injectAxe(page);
  const violations = await getViolations(page);
  const summary = violations
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
    .join("\n");
  expect(violations, summary).toHaveLength(0);
}
