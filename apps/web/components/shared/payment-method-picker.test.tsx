import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentMethodPicker } from "./payment-method-picker";

const labels = { CASH: "Cash", BANK_TRANSFER: "Bank", MFS: "Mobile banking" };

describe("PaymentMethodPicker", () => {
  it("shows the three methods as one radio group with the current one checked", () => {
    render(<PaymentMethodPicker value="CASH" onChange={vi.fn()} labels={labels} groupLabel="Payment method" />);

    expect(screen.getByRole("radiogroup", { name: "Payment method" })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Cash" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Bank" }).getAttribute("aria-checked")).toBe("false");
  });

  it("reports the chosen method", async () => {
    const onChange = vi.fn();
    render(<PaymentMethodPicker value="CASH" onChange={onChange} labels={labels} groupLabel="Payment method" />);

    await userEvent.click(screen.getByRole("radio", { name: "Mobile banking" }));

    expect(onChange).toHaveBeenCalledWith("MFS");
  });

  it("does not fire while disabled", async () => {
    const onChange = vi.fn();
    render(<PaymentMethodPicker value="CASH" onChange={onChange} labels={labels} groupLabel="Payment method" disabled />);

    await userEvent.click(screen.getByRole("radio", { name: "Bank" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
