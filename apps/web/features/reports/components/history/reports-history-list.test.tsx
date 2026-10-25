import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import { ReportsHistoryList } from "./reports-history-list";
import { makeReport } from "./report-fixture";

vi.mock("@/features/reports", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/reports")>();
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return { ...actual, useDownloadReport: mutation, useRetryReport: mutation, useDeleteReport: mutation };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const rows = [
  makeReport({ id: "done", status: "COMPLETED", hasPdf: true }),
  makeReport({ id: "nopdf", status: "COMPLETED", hasPdf: false }),
  makeReport({ id: "bad", status: "FAILED", hasPdf: false, errorCategory: "RENDER_FAILED", errorMessage: "internal boom" }),
  makeReport({ id: "busy", status: "PROCESSING", hasPdf: false, completedAt: null }),
];

function renderList(props: { canRetry: boolean; canDelete: boolean }) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <ReportsHistoryList items={rows} {...props} />
    </NextIntlClientProvider>,
  );
  const table = within(screen.getByRole("table"));
  // header row first, then one row per report in order
  const body = table.getAllByRole("row").slice(1);
  return { table, body };
}

describe("ReportsHistoryList row actions", () => {
  it("owner: Open on every row, Delete on every row, Retry only on the FAILED row", () => {
    const { body } = renderList({ canRetry: true, canDelete: true });
    expect(body).toHaveLength(4);
    for (const row of body) {
      expect(within(row).getByRole("link", { name: "Open" })).toBeTruthy();
      expect(within(row).getByRole("button", { name: "Delete" })).toBeTruthy();
    }
    expect(within(body[2]).getByRole("button", { name: "Try again" })).toBeTruthy();
    for (const i of [0, 1, 3]) expect(within(body[i]).queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("without reports.delete there is no Delete control at all; without reports.create there is no Retry", () => {
    const { table, body } = renderList({ canRetry: false, canDelete: false });
    expect(table.queryAllByRole("button", { name: "Delete" })).toHaveLength(0);
    expect(table.queryAllByRole("button", { name: "Try again" })).toHaveLength(0);
    expect(within(body[0]).getByRole("link", { name: "Open" })).toBeTruthy();
  });

  it("Download PDF is active only for a COMPLETED report with a PDF; the others are aria-disabled", () => {
    const { body } = renderList({ canRetry: true, canDelete: true });
    const dl = (i: number) => within(body[i]).getByRole("button", { name: "Download PDF" });
    expect(dl(0).getAttribute("aria-disabled")).toBeNull();
    expect(dl(1).getAttribute("aria-disabled")).toBe("true");
    expect(dl(2).getAttribute("aria-disabled")).toBe("true");
    expect(dl(3).getAttribute("aria-disabled")).toBe("true");
  });

  it("shows the safe localized failure text, never the backend's raw message", () => {
    const { body } = renderList({ canRetry: true, canDelete: true });
    expect(within(body[2]).getByText(en.reports.errorCategory.RENDER_FAILED)).toBeTruthy();
    expect(screen.queryByText("internal boom")).toBeNull();
  });

  it("labels the origin and status of each row", () => {
    const { body } = renderList({ canRetry: true, canDelete: true });
    expect(within(body[0]).getByText("Scheduled")).toBeTruthy();
    expect(within(body[0]).getByText("Ready")).toBeTruthy();
    expect(within(body[3]).getByText("Generating")).toBeTruthy();
    expect(within(body[2]).getAllByText("Failed").length).toBeGreaterThan(0);
  });
});
