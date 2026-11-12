import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MoneyInput, parseMoneyInput } from "./money-input";

vi.mock("next-intl", () => ({ useLocale: () => "en" }));

describe("parseMoneyInput", () => {
  it("parses a plain integer string", () => {
    expect(parseMoneyInput("1234")).toBe(1234);
  });

  it("parses a decimal string", () => {
    expect(parseMoneyInput("125000.50")).toBe(125000.5);
  });

  it("strips non-numeric characters (e.g. a stray thousands separator)", () => {
    expect(parseMoneyInput("1,25,000")).toBe(125000);
  });

  it("returns undefined for an empty string", () => {
    expect(parseMoneyInput("")).toBeUndefined();
  });

  it("returns undefined for a bare minus sign or decimal point", () => {
    expect(parseMoneyInput("-")).toBeUndefined();
    expect(parseMoneyInput(".")).toBeUndefined();
    expect(parseMoneyInput("-.")).toBeUndefined();
  });

  it("returns undefined for a malformed multi-decimal draft", () => {
    expect(parseMoneyInput("12.34.56")).toBeUndefined();
  });

  it("preserves a leading negative sign (min clamping, not the parser, rejects negatives)", () => {
    expect(parseMoneyInput("-500")).toBe(-500);
  });
});

describe("MoneyInput", () => {
  it("shows the raw digit string while focused and the formatted value once blurred", () => {
    function Harness() {
      const [value, setValue] = useState<number | undefined>(125000);
      return <MoneyInput label="Amount" value={value} onChange={setValue} />;
    }
    render(<Harness />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    // Blurred (initial): lakh-grouped formatted display, per `lib/format.ts#formatNumber`.
    expect(input.value).toBe("1,25,000");

    fireEvent.focus(input);
    // Focused: raw underlying numeric string, no grouping — so typing doesn't fight the cursor.
    expect(input.value).toBe("125000");

    fireEvent.change(input, { target: { value: "125000.5" } });
    expect(input.value).toBe("125000.5");

    fireEvent.blur(input);
    expect(input.value).toBe("1,25,000.5");
  });

  it("rejects a keystroke that would produce an invalid draft (a second decimal point)", () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState<number | undefined>(undefined);
      return (
        <MoneyInput
          label="Amount"
          value={value}
          onChange={(v) => {
            setValue(v);
            onChange(v);
          }}
        />
      );
    }
    render(<Harness />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "12.5" } });
    expect(input.value).toBe("12.5");
    fireEvent.change(input, { target: { value: "12.5." } });
    // The second `.` never lands in the buffer — `isValidMoneyDraft` rejects the keystroke outright.
    expect(input.value).toBe("12.5");
  });

  it("clamps a below-minimum value up to `min` on blur (default min 0)", () => {
    function Harness() {
      const [value, setValue] = useState<number | undefined>(undefined);
      return <MoneyInput label="Amount" value={value} onChange={setValue} />;
    }
    render(<Harness />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "-50" } });
    fireEvent.blur(input);
    expect(input.value).toBe("0");
  });

  it("renders an error message when `error` is supplied", () => {
    render(<MoneyInput label="Amount" value={undefined} onChange={vi.fn()} error="Amount is required" />);
    expect(screen.getByText("Amount is required")).toBeInTheDocument();
  });
});
