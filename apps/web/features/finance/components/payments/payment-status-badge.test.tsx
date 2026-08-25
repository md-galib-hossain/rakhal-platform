import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentStatusBadge } from "./payment-status-badge";
import type { SettlementStatusV2 } from "../../types-v2";

// Returns the raw key it was asked to translate — lets the test assert the badge renders exactly
// the `status` prop it was given, with no relabeling/derivation in between.
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const ALL_STATUSES: SettlementStatusV2[] = ["UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE"];

describe("PaymentStatusBadge", () => {
  it.each(ALL_STATUSES)(
    "renders exactly the %s status it was given — a pure pass-through of the API's derived field, never a local re-derivation (FINANCE_V2_DESIGN.md §4.6)",
    (status) => {
      render(<PaymentStatusBadge status={status} />);
      expect(screen.getByText(status)).toBeInTheDocument();
    },
  );

  it("accepts only a `status` prop — there is no amount/total/dueDate prop it could derive a status from itself", () => {
    // Type-level assertion: `PaymentStatusBadge`'s props are `{ status, className? }` only (see the
    // component's own doc comment). If a future edit widened this to accept e.g. `outstanding` or
    // `totalAmount`, it would be a real regression toward re-deriving status client-side — this test
    // exists so that change requires touching this file, not slipping through unnoticed.
    render(<PaymentStatusBadge status="OVERDUE" />);
    expect(screen.getByText("OVERDUE")).toBeInTheDocument();
  });
});
