import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import { makeReport } from "../history/report-fixture";
import { ScheduledReportCard } from "./scheduled-report-card";

const h = vi.hoisted(() => ({
  state: { items: [] as unknown[], isLoading: false, isError: false },
  calls: [] as unknown[],
}));

vi.mock("@/features/reports", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/reports")>();
  return {
    ...actual,
    useDownloadReport: () => ({ mutate: vi.fn(), isPending: false }),
    useReportsInfinite: (filters: unknown, options: unknown) => {
      h.calls.push([filters, options]);
      return { ...h.state, refetch: vi.fn(), hasNextPage: false };
    },
  };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderCard(kind: "WEEKLY" | "MONTHLY" = "WEEKLY") {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <ScheduledReportCard kind={kind} />
    </NextIntlClientProvider>,
  );
}

describe("ScheduledReportCard", () => {
  beforeEach(() => {
    h.state = { items: [], isLoading: false, isError: false };
    h.calls = [];
  });

  it("asks for the newest scheduled report of its own type, one row", () => {
    renderCard("MONTHLY");
    expect(h.calls[0]).toEqual([{ origin: "SCHEDULED", type: "MONTHLY" }, { pageSize: 1 }]);
  });

  it("empty: friendly text, no Open button, no invented next-run date", () => {
    renderCard("WEEKLY");
    expect(screen.getByText("Created automatically after each week closes.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /open/i })).toBeNull();
    expect(screen.queryByText(/next/i)).toBeNull();
  });

  it("monthly empty text says month", () => {
    renderCard("MONTHLY");
    expect(screen.getByText("Created automatically after each month closes.")).toBeTruthy();
  });

  it("latest COMPLETED with a PDF: status, Open link and Download PDF", () => {
    h.state.items = [makeReport({ id: "abc" })];
    renderCard();
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe("/reports/abc");
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeTruthy();
  });

  it("COMPLETED without a PDF: Open only", () => {
    h.state.items = [makeReport({ hasPdf: false })];
    renderCard();
    expect(screen.getByRole("link", { name: "Open" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Download PDF" })).toBeNull();
  });

  it("FAILED: safe error text and Open, no download, never the raw backend message", () => {
    h.state.items = [
      makeReport({ status: "FAILED", hasPdf: false, errorCategory: "STORAGE_UNAVAILABLE", errorMessage: "ECONNREFUSED 10.0.0.4" }),
    ];
    renderCard();
    expect(screen.getByRole("alert").textContent).toBe(en.reports.errorCategory.STORAGE_UNAVAILABLE);
    expect(screen.getByRole("link", { name: "Open" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Download PDF" })).toBeNull();
    expect(screen.queryByText(/ECONNREFUSED/)).toBeNull();
  });

  it("loading shows a busy skeleton", () => {
    h.state.isLoading = true;
    renderCard();
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("error offers a retry", () => {
    h.state.isError = true;
    renderCard();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
