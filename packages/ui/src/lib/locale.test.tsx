import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider, useLocale, formatMoney, formatDate } from "./locale";

function Probe() {
  return <p>{useLocale()}</p>;
}

describe("LocaleProvider / useLocale", () => {
  it("throws when used outside a LocaleProvider", () => {
    expect(() => render(<Probe />)).toThrow(/must be called within a <LocaleProvider>/);
  });

  it("returns the provided locale", () => {
    render(
      <LocaleProvider locale="bn">
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByText("bn")).toBeInTheDocument();
  });
});

describe("formatMoney / formatDate", () => {
  it("formats money with lakh grouping and Latin digits in both locales", () => {
    expect(formatMoney(125000, "bn")).toBe("৳1,25,000");
    expect(formatMoney(125000, "en")).toBe("৳1,25,000");
  });

  it("formats a date with the default medium style", () => {
    expect(formatDate("2026-07-09", "en")).toBe("Jul 9, 2026");
  });
});
